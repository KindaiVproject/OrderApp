import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  const org = await requireOrg();
  const [orders, products] = await Promise.all([
    prisma.order.findMany({
      where: { orgId: org.id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      where: { orgId: org.id, active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return <HistoryClient initialOrders={orders} products={products} />;
}
