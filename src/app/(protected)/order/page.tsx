import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OrderClient from "./OrderClient";

export default async function OrderPage() {
  const org = await requireOrg();
  const products = await prisma.product.findMany({
    where: { orgId: org.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return <OrderClient products={products} />;
}
