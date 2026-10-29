import { prisma } from "@/lib/prisma";
import { getMyInstances, requireSession } from "@/lib/instance";
import { getVapidPublicKey } from "@/lib/webpush";
import AccountClient from "./AccountClient";

export default async function AccountPage() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const hasOpenableInstance = (await getMyInstances()).some((i) => i.active);

  return (
    <AccountClient
      email={user?.email ?? session.user!.email!}
      googleName={user?.name ?? null}
      image={user?.image ?? null}
      initialDisplayName={user?.displayName ?? ""}
      hasOpenableInstance={hasOpenableInstance}
      initialReminder30={user?.shiftReminder30 ?? true}
      vapidPublicKey={getVapidPublicKey()}
    />
  );
}
