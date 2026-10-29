import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";

const MAX_DISPLAY_NAME_LENGTH = 30;

// Admin edits another user's own display name (User.displayName) from the
// all-users screen — e.g. to fix a name that is wrong or unsuitable. Empty
// clears it, so the Google name is used again.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id } = await params;

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

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const updated = await prisma.user.update({ where: { id }, data: { displayName } });
  return NextResponse.json({ displayName: updated.displayName });
}
