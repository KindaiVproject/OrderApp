import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentInstance, isInstanceAdmin } from "@/lib/instance";
import { revertLog } from "@/lib/revert";

// Undo one edit-log entry. Same people who may read the log (instance admins of
// the current instance, and Admin); the entry must belong to that instance.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  const instance = await getCurrentInstance();
  if (!instance || !(await isInstanceAdmin(instance.id, email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const result = await revertLog(id, instance.id, email);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, skippedMembers: result.skippedMembers });
}
