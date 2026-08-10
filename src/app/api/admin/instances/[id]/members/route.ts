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
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 });
  }

  const instance = await prisma.instance.findUnique({ where: { id } });
  if (!instance) return NextResponse.json({ error: "not found" }, { status: 404 });

  const existingUser = await prisma.user.findUnique({ where: { email } });

  const member = await prisma.instanceMember.upsert({
    where: { instanceId_email: { instanceId: id, email } },
    update: {},
    create: { instanceId: id, email, userId: existingUser?.id },
    include: { user: true },
  });

  return NextResponse.json(member, { status: 201 });
}
