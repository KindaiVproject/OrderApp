import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const session = await auth();
  if (session?.user?.email !== getAdminEmail()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id, memberId } = await params;

  await prisma.instanceMember.deleteMany({ where: { id: memberId, instanceId: id } });
  return NextResponse.json({ ok: true });
}
