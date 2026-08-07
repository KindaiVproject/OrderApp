import { requireCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import OrderClient from "./OrderClient";

export default async function OrderPage() {
  const instance = await requireCurrentInstance();
  const products = await prisma.product.findMany({
    where: { instanceId: instance.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return <OrderClient products={products} />;
}
