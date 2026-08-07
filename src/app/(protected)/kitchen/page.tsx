import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import KitchenClient from "./KitchenClient";

export default async function KitchenPage() {
  const org = await requireOrg();
  const [orders, products] = await Promise.all([
    prisma.order.findMany({
      where: { orgId: org.id, status: "WAITING" },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.product.findMany({
      where: { orgId: org.id, active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return <KitchenClient initialOrders={orders} products={products} />;
}
