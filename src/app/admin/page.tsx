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
  // then the user's own chosen name, then the Google account name.
  const bootstrapAdminEmail = getAdminEmail();
  const adminEmails = [bootstrapAdminEmail, ...adminInvites.map((invite) => invite.email)].filter(Boolean);
  const users = await prisma.user.findMany({ where: { email: { in: adminEmails } } });
  const adminProfiles: Record<string, { name: string | null; image: string | null }> = {};
  for (const email of adminEmails) {
    const manual = instances.flatMap((i) => i.members).find((m) => m.email === email && m.displayName);
    const user = users.find((u) => u.email === email);
    const name = manual?.displayName ?? user?.displayName ?? user?.name ?? null;
    if (name || user?.image) adminProfiles[email] = { name, image: user?.image ?? null };
  }

  return (
    <AdminClient
      initialInstances={instances}
      initialAdminInvites={adminInvites}
      bootstrapAdminEmail={bootstrapAdminEmail}
      adminProfiles={adminProfiles}
    />
  );
}
