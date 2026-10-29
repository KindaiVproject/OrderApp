import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_DISPLAY_NAME_LENGTH = 30;

// A signed-in user updates their own settings: display name (empty clears it)
// and the 30-minute shift reminder toggle.
export async function PATCH(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const data: { displayName?: string | null; shiftReminder30?: boolean } = {};

  if (body?.displayName !== undefined) {
    if (typeof body.displayName !== "string" && body.displayName !== null) {
      return NextResponse.json({ error: "表示名を指定してください" }, { status: 400 });
    }
    const displayName = body.displayName === null ? null : body.displayName.trim() || null;
    if (displayName && displayName.length > MAX_DISPLAY_NAME_LENGTH) {
      return NextResponse.json(
        { error: `表示名は${MAX_DISPLAY_NAME_LENGTH}文字以内で入力してください` },
        { status: 400 },
      );
    }
    data.displayName = displayName;
  }
  if (body?.shiftReminder30 !== undefined) {
    if (typeof body.shiftReminder30 !== "boolean") {
      return NextResponse.json({ error: "設定の値が不正です" }, { status: 400 });
    }
    data.shiftReminder30 = body.shiftReminder30;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "更新する項目を指定してください" }, { status: 400 });
  }

  const user = await prisma.user.update({ where: { email }, data });
  return NextResponse.json({ displayName: user.displayName, shiftReminder30: user.shiftReminder30 });
}
