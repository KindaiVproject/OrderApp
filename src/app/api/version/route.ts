import { NextResponse } from "next/server";

// The version of the deployment answering this request. Open pages poll it to
// find out they are out of date. Never cached.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
