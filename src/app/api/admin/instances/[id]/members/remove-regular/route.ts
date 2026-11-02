import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminEmail, isAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import { logEdit } from "@/lib/editLog";

// Admin only: removes every member of the instance who is neither a global
// Admin nor an instance admin ("一般メンバー"), in one go — e.g. to clear an
// instance after an event. Typing the instance's exact name is required, and is
// checked here as well as in the UI.
//
// A removed member loses the instance membership (and, by cascade, their shift
// assignments there). Their account, other instances, and the instance's own
// records (orders, products, edit log) are untouched, and they can be invited
// again later.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id } = await params;

  const instance = await prisma.instance.findUnique({ where: { id } });
  if (!instance) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.confirmName !== "string" || body.confirmName !== instance.name) {
    return NextResponse.json({ error: "確認のインスタンス名が一致しません" }, { status: 400 });
  }

  // Global Admins are kept even when they hold a plain membership.
  const adminInvites = await prisma.adminInvite.findMany();
  const adminEmails = [getAdminEmail(), ...adminInvites.map((a) => a.email)].filter(Boolean);

  const targets = await prisma.instanceMember.findMany({
    where: { instanceId: id, isInstanceAdmin: false, email: { notIn: adminEmails } },
    select: { id: true },
  });
  if (targets.length === 0) {
    return NextResponse.json({ removed: 0, removedIds: [] });
  }

  await prisma.instanceMember.deleteMany({ where: { id: { in: targets.map((t) => t.id) } } });
  await logEdit({
    instanceId: id,
    entityType: "MEMBER",
    entityId: id,
    action: "DELETE",
    summary: `一般メンバー${targets.length}人を一括で外しました`,
    actorEmail: session?.user?.email,
  });
  return NextResponse.json({ removed: targets.length, removedIds: targets.map((t) => t.id) });
}
