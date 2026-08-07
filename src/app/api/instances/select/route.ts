import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CURRENT_INSTANCE_COOKIE } from "@/lib/instance";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const instanceId = typeof body?.instanceId === "string" ? body.instanceId : "";

  const membership = await prisma.instanceMember.findUnique({
    where: { instanceId_email: { instanceId, email: session.user.email } },
    include: { instance: true },
  });
  if (!membership || !membership.instance.active) {
    return NextResponse.json({ error: "このインスタンスは選択できません" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(CURRENT_INSTANCE_COOKIE, instanceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
