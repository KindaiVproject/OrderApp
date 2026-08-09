import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "インスタンス名を入力してください" }, { status: 400 });
  }

  const source = await prisma.instance.findUnique({
    where: { id },
    include: {
      products: { where: { active: true } },
      members: true,
    },
  });
  if (!source) return NextResponse.json({ error: "not found" }, { status: 404 });

  const instance = await prisma.instance.create({
    data: {
      name,
      label,
      active: true,
      products: {
        create: source.products.map((p) => ({
          name: p.name,
          price: p.price,
          imageUrl: p.imageUrl,
          sortOrder: p.sortOrder,
        })),
      },
      members: {
        create: source.members.map((m) => ({ email: m.email })),
      },
    },
    include: { members: true },
  });

  return NextResponse.json(instance, { status: 201 });
}
