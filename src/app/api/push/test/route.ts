import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPushConfigured, sendPushToUser } from "@/lib/webpush";

// "テスト通知を送る" button on /account: pushes to the caller's own browsers.
export async function POST() {
  const email = (await auth())?.user?.email;
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "通知の設定がサーバーに入っていません" }, { status: 503 });
  }

  const { sent } = await sendPushToUser(user.id, {
    title: "テスト通知",
    body: "通知は正常に届いています",
    url: "/account",
  });
  return NextResponse.json({ sent });
}
