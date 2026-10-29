import { prisma } from "@/lib/prisma";
import { getMyInstances, isAdminEmail, requireSession } from "@/lib/instance";
import { getVapidPublicKey } from "@/lib/webpush";
import AccountClient from "./AccountClient";

export default async function AccountPage() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  // Shifts stay viewable on stopped instances, so any membership counts.
  const instances = await getMyInstances();
  const hasInstance = instances.length > 0;

  // What deleting the account would remove, shown in the confirmation.
  const email = session.user!.email!;
  const [assignments, devices, isAdmin] = await Promise.all([
    prisma.shiftAssignment.count({ where: { member: { email } } }),
    user ? prisma.pushSubscription.count({ where: { userId: user.id } }) : 0,
    isAdminEmail(email),
  ]);

  return (
    <AccountClient
      email={user?.email ?? session.user!.email!}
      googleName={user?.name ?? null}
      image={user?.image ?? null}
      initialDisplayName={user?.displayName ?? ""}
      hasInstance={hasInstance}
      initialReminder30={user?.shiftReminder30 ?? true}
      vapidPublicKey={getVapidPublicKey()}
      deletion={{
        isAdmin,
        instanceNames: instances.map((i) => i.name),
        assignments,
        devices,
      }}
    />
  );
}
