import { getAdminEmail, requireAdmin } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  await requireAdmin();
  const [instances, adminInvites] = await Promise.all([
    prisma.instance.findMany({
      include: { members: { include: { user: true }, orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.adminInvite.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  // Same priority as members: a display name set on any instance membership,
  // then the Google account name once the Admin has signed in.
  const bootstrapAdminEmail = getAdminEmail();
  const adminEmails = [bootstrapAdminEmail, ...adminInvites.map((invite) => invite.email)].filter(Boolean);
  const users = await prisma.user.findMany({
    where: { email: { in: adminEmails } },
    select: { email: true, name: true },
  });
  const adminNames: Record<string, string> = {};
  for (const email of adminEmails) {
    const manual = instances.flatMap((i) => i.members).find((m) => m.email === email && m.displayName);
    const name = manual?.displayName ?? users.find((u) => u.email === email)?.name;
    if (name) adminNames[email] = name;
  }

  return (
    <AdminClient
      initialInstances={instances}
      initialAdminInvites={adminInvites}
      bootstrapAdminEmail={bootstrapAdminEmail}
      adminNames={adminNames}
    />
  );
}
