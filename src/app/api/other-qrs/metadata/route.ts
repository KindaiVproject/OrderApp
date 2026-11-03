import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentInstance, isInstanceAdmin } from "@/lib/instance";
import { normalizePaymentLink } from "@/lib/paymentLinks";
import { suggestLabel } from "@/lib/pageMeta";

// A label suggested from the page's metadata (og:title, <title>…), for the
// "その他のQR" form. The server fetches the page, so only people who can
// register QRs may call it.
export async function GET(request: Request) {
  const session = await auth();
  const instance = await getCurrentInstance();
  if (!instance || !(await isInstanceAdmin(instance.id, session?.user?.email))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const url = normalizePaymentLink(new URL(request.url).searchParams.get("url"));
  const suggestion = url ? await suggestLabel(url) : null;
  if (!suggestion) {
    return NextResponse.json({ error: "https:// で始まるリンクを入力してください" }, { status: 400 });
  }
  return NextResponse.json(suggestion);
}
