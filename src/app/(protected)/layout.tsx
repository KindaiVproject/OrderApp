import Header from "@/components/Header";
import { isAdminEmail, isInstanceAdmin, requireCurrentInstance } from "@/lib/instance";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveName } from "@/lib/memberName";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const instance = await requireCurrentInstance();
  const session = await auth();
  const isAdmin = await isAdminEmail(session?.user?.email);
  const canManageInstance = isAdmin || (await isInstanceAdmin(instance.id, session?.user?.email));

  const email = session?.user?.email ?? "";
  const [user, member] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.instanceMember.findUnique({ where: { instanceId_email: { instanceId: instance.id, email } } }),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <Header
        userName={resolveName(email, member?.displayName, user)}
        userImage={user?.image ?? null}
        instanceName={instance.name}
        instanceLabel={instance.label}
        isAdmin={isAdmin}
        canManageInstance={canManageInstance}
      />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
