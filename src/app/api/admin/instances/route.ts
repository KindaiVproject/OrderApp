import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "インスタンス名を入力してください" }, { status: 400 });
  }

  const instance = await prisma.instance.create({
    data: {
      name,
      label,
      members: { create: { email: session!.user!.email! } },
    },
    include: { members: true },
  });

  return NextResponse.json(instance, { status: 201 });
}
