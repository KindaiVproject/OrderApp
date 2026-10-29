import type { InstanceModel } from "@generated/prisma/models";
import { auth } from "@/auth";
import Header from "@/components/Header";
import { isAdminEmail, isInstanceAdmin } from "@/lib/instance";
import { resolveName } from "@/lib/memberName";
import { prisma } from "@/lib/prisma";

// The app header for an instance, shared by the protected layout and by
// pages outside it (e.g. /shifts) that still want it when an instance is
// selected.
export default async function InstanceHeader({ instance }: { instance: InstanceModel }) {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const isAdmin = await isAdminEmail(email);
  const canManageInstance = isAdmin || (await isInstanceAdmin(instance.id, email));
  const [user, member] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.instanceMember.findUnique({ where: { instanceId_email: { instanceId: instance.id, email } } }),
  ]);

  return (
    <Header
      userName={resolveName(email, member?.displayName, user)}
      userImage={user?.image ?? null}
      instanceId={instance.id}
      instanceName={instance.name}
      instanceLabel={instance.label}
      isAdmin={isAdmin}
      canManageInstance={canManageInstance}
    />
  );
}
