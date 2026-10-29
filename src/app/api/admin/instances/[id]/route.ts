import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/instance";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const data: { active?: boolean; name?: string; label?: string; reactivateAt?: Date | null } = {};
  if (body?.active !== undefined) {
    data.active = Boolean(body.active);
    // Switching to active by hand cancels any scheduled resume.
    if (data.active) data.reactivateAt = null;
  }
  // Scheduled resume: "YYYY-MM-DDTHH:MM" in Japan time, or null to cancel.
  if (body?.reactivateAt !== undefined) {
    if (body.reactivateAt === null) {
      data.reactivateAt = null;
    } else {
      const text = typeof body.reactivateAt === "string" ? body.reactivateAt : "";
      const at = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text) ? new Date(`${text}:00+09:00`) : null;
      if (!at || Number.isNaN(at.getTime())) {
        return NextResponse.json({ error: "復帰する日時を指定してください" }, { status: 400 });
      }
      if (at.getTime() <= Date.now()) {
        return NextResponse.json({ error: "復帰日時は現在より後にしてください" }, { status: 400 });
      }
      const current = await prisma.instance.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
      if ((data.active ?? current.active) === true) {
        return NextResponse.json({ error: "稼働中のインスタンスには復帰予約できません" }, { status: 400 });
      }
      data.reactivateAt = at;
    }
  }
  if (body?.name !== undefined) data.name = String(body.name).trim();
  if (body?.label !== undefined) data.label = String(body.label).trim();

  const instance = await prisma.instance.update({ where: { id }, data });
  return NextResponse.json(instance);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!(await isAdminEmail(session?.user?.email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id } = await params;

  // Cascades to the instance's products, orders, order items, and
  // memberships (see schema.prisma) — this permanently deletes that
  // stall's sales history. Callers must confirm before hitting this.
  await prisma.instance.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
