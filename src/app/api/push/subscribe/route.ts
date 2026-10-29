import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function currentUser() {
  const email = (await auth())?.user?.email;
  return email ? prisma.user.findUnique({ where: { email } }) : null;
}

// Registers the calling browser for push. An endpoint is unique to one
// browser profile, so it is re-pointed if it was registered to someone else.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const authKey = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint.startsWith("https://") || !p256dh || !authKey) {
    return NextResponse.json({ error: "購読情報が不正です" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.id, p256dh, auth: authKey },
    create: { userId: user.id, endpoint, p256dh, auth: authKey },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return NextResponse.json({ ok: true });
}
