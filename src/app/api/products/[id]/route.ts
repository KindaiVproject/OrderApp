import { NextResponse } from "next/server";
import { getCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { isValidProductImagePath } from "@/lib/uploads";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.product.findFirst({ where: { id, instanceId: instance.id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const data: { name?: string; price?: number; active?: boolean; imageUrl?: string | null } = {};

  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "商品名を入力してください" }, { status: 400 });
    data.name = name;
  }
  if (body?.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isInteger(price) || price < 0) {
      return NextResponse.json({ error: "価格は0以上の整数で入力してください" }, { status: 400 });
    }
    data.price = price;
  }
  if (body?.active !== undefined) {
    data.active = Boolean(body.active);
  }
  if (body?.imageUrl !== undefined) {
    const imageUrl = body.imageUrl === null ? null : String(body.imageUrl);
    if (imageUrl && !isValidProductImagePath(imageUrl)) {
      return NextResponse.json({ error: "画像の指定が不正です" }, { status: 400 });
    }
    data.imageUrl = imageUrl;
  }

  const product = await prisma.product.update({ where: { id }, data });
  return NextResponse.json(product);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.product.findFirst({ where: { id, instanceId: instance.id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Soft delete: keep the row so past orders/CSV history keep working.
  await prisma.product.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
