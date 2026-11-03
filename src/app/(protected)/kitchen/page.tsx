import { isInstanceAdmin, requireCurrentInstance, requireSession } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import KitchenClient from "./KitchenClient";

export default async function KitchenPage() {
  const instance = await requireCurrentInstance();
  const session = await requireSession();
  const [orders, products, canEditSound] = await Promise.all([
    prisma.order.findMany({
      where: { instanceId: instance.id, status: "WAITING" },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.product.findMany({
      where: { instanceId: instance.id, active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    isInstanceAdmin(instance.id, session.user?.email),
  ]);

  return (
    <KitchenClient
      initialOrders={orders}
      products={products}
      initialSoundId={instance.orderSound}
      canEditSound={canEditSound}
    />
  );
}
