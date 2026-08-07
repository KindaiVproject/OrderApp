import { NextResponse } from "next/server";
import { getCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { instanceId: instance.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(products);
}

export async function POST(request: Request) {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const price = Number(body?.price);

  if (!name) {
    return NextResponse.json({ error: "商品名を入力してください" }, { status: 400 });
  }
  if (!Number.isInteger(price) || price < 0) {
    return NextResponse.json({ error: "価格は0以上の整数で入力してください" }, { status: 400 });
  }

  const maxSort = await prisma.product.aggregate({
    where: { instanceId: instance.id },
    _max: { sortOrder: true },
  });

  const product = await prisma.product.create({
    data: {
      instanceId: instance.id,
      name,
      price,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(product, { status: 201 });
}
