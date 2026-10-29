import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/instance";
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

// Deletes the caller's own account for good. Guards, all enforced here and not
// just in the UI: a signed-in user, who is not an Admin (Admin status is tied to
// the email and would silently survive the deletion), and who has typed their
// own email address as confirmation.
//
// Removes: the User (and with it Google link, sessions, notification devices),
// and every InstanceMember of that email (and with it the shift assignments).
// Kept: the instances' own records (orders, products) and the edit log's
// "who did it" entries, which are an audit trail.
export async function DELETE(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (await isAdminEmail(email)) {
    return NextResponse.json(
      { error: "Admin権限のあるアカウントは削除できません。先にAdmin権限を外してもらってください" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const typed = typeof body?.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";
  if (typed !== email.toLowerCase()) {
    return NextResponse.json({ error: "確認のメールアドレスが一致しません" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.instanceMember.deleteMany({ where: { email } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
