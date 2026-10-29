import webpush from "web-push";
import { prisma } from "@/lib/prisma";

export type PushPayload = { title: string; body: string; url: string };

// VAPID keys are generated once with `npx web-push generate-vapid-keys` and
// set as env vars (see docs/SPEC.md). Without them push is simply disabled.
export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

// Sends to every browser the user enabled notifications on. Subscriptions
// the push service reports as gone (404/410) are deleted. Returns how many
// deliveries succeeded.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!isPushConfigured()) return 0;
  configure();
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 30 },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
        } else {
          console.error("web push failed", status, e);
        }
      }
    }),
  );
  return sent;
}
