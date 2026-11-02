import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireSession } from "@/lib/instance";
import AccessQrClient from "./AccessQrClient";

// The address the QR opens: the production domain when Vercel tells us (same
// source as the link-card base URL in layout.tsx), otherwise the host this
// request came in on (local development).
async function appUrl(): Promise<string> {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function AccessQrPage() {
  await requireSession();
  const url = await appUrl();
  // Level H survives the logo AccessQrClient lays over the middle.
  const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 2, width: 800 });
  return <AccessQrClient url={url} qr={qr} />;
}
