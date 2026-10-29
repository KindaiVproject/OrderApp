import { prisma } from "@/lib/prisma";
import { getMyInstances, requireSession } from "@/lib/instance";
import { getVapidPublicKey } from "@/lib/webpush";
import AccountClient from "./AccountClient";

export default async function AccountPage() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  // Shifts stay viewable on stopped instances, so any membership counts.
  const hasInstance = (await getMyInstances()).length > 0;

  return (
    <AccountClient
      email={user?.email ?? session.user!.email!}
      googleName={user?.name ?? null}
      image={user?.image ?? null}
      initialDisplayName={user?.displayName ?? ""}
      hasInstance={hasInstance}
      initialReminder30={user?.shiftReminder30 ?? true}
      vapidPublicKey={getVapidPublicKey()}
    />
  );
}
