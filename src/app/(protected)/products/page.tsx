import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  const org = await requireOrg();
  const products = await prisma.product.findMany({
    where: { orgId: org.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return <ProductsClient initialProducts={products} />;
}
