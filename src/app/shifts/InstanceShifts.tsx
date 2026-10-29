import { auth } from "@/auth";
import { canManageMembers, isAdminEmail } from "@/lib/instance";
import { currentTimeMs } from "@/lib/datetime";
import { shiftMemberName } from "@/lib/memberName";
import { prisma } from "@/lib/prisma";
import ShiftsClient from "./ShiftsClient";

// One instance's full shift view. Shared by /shifts?instance=<id> and by
// /shifts/current (the in-instance screen with the regular header).
export default async function InstanceShifts({ instanceId }: { instanceId: string }) {
  const session = await auth();
  const email = session?.user?.email ?? "";

  const [instance, shifts, members, roles, isAdmin, canSeeAddresses] = await Promise.all([
    prisma.instance.findUnique({ where: { id: instanceId } }),
    prisma.shift.findMany({
      where: { instanceId },
      include: { assignments: { include: { member: { include: { user: true } } } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.instanceMember.findMany({
      where: { instanceId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.shiftRole.findMany({ where: { instanceId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    isAdminEmail(email),
    canManageMembers(instanceId, email),
  ]);

  // Names are resolved here, so a member nobody has named never reaches the
  // browser of someone who can't manage members as a full email address.
  return (
    <>
      {instance && !instance.active && (
        <p className="mx-auto w-full max-w-3xl px-4 pt-4 text-xs text-amber-700">
          このインスタンスは停止中です。シフトのみ閲覧{isAdmin ? "・編集" : ""}できます。
        </p>
      )}
      <ShiftsClient
        instanceId={instanceId}
        isAdmin={isAdmin}
        nowMs={currentTimeMs()}
        // Only the Admin's form needs the pick-list of members.
        members={
          isAdmin
            ? members.map((m) => ({
                id: m.id,
                name: shiftMemberName(m, true),
                image: m.user?.image ?? null,
                unapproved: !m.userId,
              }))
            : []
        }
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        shifts={shifts.map((s) => ({
          id: s.id,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          assignments: s.assignments.map((a) => ({
            memberId: a.memberId,
            role: a.role,
            name: shiftMemberName(a.member, canSeeAddresses),
            image: a.member.user?.image ?? null,
            isMe: a.member.email === email,
            unapproved: !a.member.userId,
          })),
        }))}
      />
    </>
  );
}
