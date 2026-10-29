import { auth } from "@/auth";
import { canManageMembers, isAdminEmail, requireCurrentInstance } from "@/lib/instance";
import { currentTimeMs } from "@/lib/datetime";
import { shiftMemberName } from "@/lib/memberName";
import { prisma } from "@/lib/prisma";
import ShiftsClient from "./ShiftsClient";

export default async function ShiftsPage() {
  const instance = await requireCurrentInstance();
  const session = await auth();
  const email = session?.user?.email ?? "";

  const [shifts, members, roles, isAdmin, canSeeAddresses] = await Promise.all([
    prisma.shift.findMany({
      where: { instanceId: instance.id },
      include: { assignments: { include: { member: { include: { user: true } } } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.instanceMember.findMany({
      where: { instanceId: instance.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.shiftRole.findMany({
      where: { instanceId: instance.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    isAdminEmail(email),
    canManageMembers(instance.id, email),
  ]);

  // Names are resolved here, so a member nobody has named never reaches the
  // browser of someone who can't manage members as a full email address.
  return (
    <ShiftsClient
      isAdmin={isAdmin}
      nowMs={currentTimeMs()}
      // Only the Admin's form needs the pick-list of members.
      members={
        isAdmin
          ? members.map((m) => ({ id: m.id, name: shiftMemberName(m, true), unapproved: !m.userId }))
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
  );
}
