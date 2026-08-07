import { requireCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import KitchenClient from "./KitchenClient";

export default async function KitchenPage() {
  const instance = await requireCurrentInstance();
  const [orders, products] = await Promise.all([
    prisma.order.findMany({
      where: { instanceId: instance.id, status: "WAITING" },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.product.findMany({
      where: { instanceId: instance.id, active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return <KitchenClient initialOrders={orders} products={products} />;
}
