import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/instance";
import { getVapidPublicKey } from "@/lib/webpush";
import AccountClient from "./AccountClient";

export default async function AccountPage() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });

  return (
    <AccountClient
      email={user?.email ?? session.user!.email!}
      googleName={user?.name ?? null}
      image={user?.image ?? null}
      initialDisplayName={user?.displayName ?? ""}
      initialReminder30={user?.shiftReminder30 ?? true}
      vapidPublicKey={getVapidPublicKey()}
    />
  );
}
