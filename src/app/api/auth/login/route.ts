import { NextResponse } from "next/server";
import { findOrgByPassword } from "@/lib/auth";
import { SESSION_COOKIE, signSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password) {
    return NextResponse.json({ error: "パスワードを入力してください" }, { status: 400 });
  }

  const org = await findOrgByPassword(password);
  if (!org) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  const token = await signSession(org.id);
  const response = NextResponse.json({ ok: true, label: org.label, name: org.name });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
