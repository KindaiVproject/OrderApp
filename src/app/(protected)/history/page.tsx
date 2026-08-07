import { requireCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  const instance = await requireCurrentInstance();
  const [orders, products] = await Promise.all([
    prisma.order.findMany({
      where: { instanceId: instance.id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      where: { instanceId: instance.id, active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return <HistoryClient initialOrders={orders} products={products} />;
}
