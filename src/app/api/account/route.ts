import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_DISPLAY_NAME_LENGTH = 30;

// A signed-in user sets their own display name. Empty clears it.
export async function PATCH(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (typeof body?.displayName !== "string" && body?.displayName !== null) {
    return NextResponse.json({ error: "表示名を指定してください" }, { status: 400 });
  }
  const displayName = body.displayName === null ? null : body.displayName.trim() || null;
  if (displayName && displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return NextResponse.json(
      { error: `表示名は${MAX_DISPLAY_NAME_LENGTH}文字以内で入力してください` },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({ where: { email }, data: { displayName } });
  return NextResponse.json({ displayName: user.displayName });
}
