import { isInstanceAdmin, requireCurrentInstance, requireSession } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  const instance = await requireCurrentInstance();
  const session = await requireSession();
  const [orders, products, canManage] = await Promise.all([
    prisma.order.findMany({
      where: { instanceId: instance.id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      where: { instanceId: instance.id, active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    isInstanceAdmin(instance.id, session.user?.email),
  ]);

  return <HistoryClient initialOrders={orders} products={products} canManage={canManage} />;
}
