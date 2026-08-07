import { requireCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  const instance = await requireCurrentInstance();
  const products = await prisma.product.findMany({
    where: { instanceId: instance.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return <ProductsClient initialProducts={products} />;
}
