import { auth } from "@/auth";
import { isAdminEmail, requireCurrentInstance } from "@/lib/instance";
import { memberDisplayName } from "@/lib/memberName";
import { currentTimeMs } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import ShiftsClient from "./ShiftsClient";

export default async function ShiftsPage() {
  const instance = await requireCurrentInstance();
  const session = await auth();
  const email = session?.user?.email ?? "";

  const [shifts, members, isAdmin] = await Promise.all([
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
    isAdminEmail(email),
  ]);

  // Only names/icons reach the client — never other members' emails.
  return (
    <ShiftsClient
      isAdmin={isAdmin}
      nowMs={currentTimeMs()}
      members={members.map((m) => ({ id: m.id, name: memberDisplayName(m) }))}
      shifts={shifts.map((s) => ({
        id: s.id,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        assignments: s.assignments.map((a) => ({
          memberId: a.memberId,
          role: a.role,
          name: memberDisplayName(a.member),
          image: a.member.user?.image ?? null,
          isMe: a.member.email === email,
        })),
      }))}
    />
  );
}
