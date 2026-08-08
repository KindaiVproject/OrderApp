import { getAdminEmail, requireAdmin } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  await requireAdmin();
  const [instances, adminInvites] = await Promise.all([
    prisma.instance.findMany({
      include: { members: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.adminInvite.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <AdminClient initialInstances={instances} initialAdminInvites={adminInvites} bootstrapAdminEmail={getAdminEmail()} />
  );
}
