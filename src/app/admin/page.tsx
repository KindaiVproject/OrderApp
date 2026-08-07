import { requireAdmin } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  await requireAdmin();
  const instances = await prisma.instance.findMany({
    include: { members: true },
    orderBy: { createdAt: "asc" },
  });

  return <AdminClient initialInstances={instances} />;
}
