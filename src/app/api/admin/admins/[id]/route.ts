import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminEmail, isAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id } = await params;

  const invite = await prisma.adminInvite.findUnique({ where: { id } });
  if (invite?.email === getAdminEmail()) {
    return NextResponse.json({ error: "このアカウントの権限は削除できません" }, { status: 400 });
  }

  await prisma.adminInvite.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
