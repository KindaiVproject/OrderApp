import Header from "@/components/Header";
import { isAdminEmail, isInstanceAdmin, requireCurrentInstance } from "@/lib/instance";
import { auth } from "@/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const instance = await requireCurrentInstance();
  const session = await auth();
  const isAdmin = await isAdminEmail(session?.user?.email);
  const canViewEditLog = isAdmin || (await isInstanceAdmin(instance.id, session?.user?.email));

  return (
    <div className="flex min-h-dvh flex-col">
      <Header
        instanceName={instance.name}
        instanceLabel={instance.label}
        isAdmin={isAdmin}
        canViewEditLog={canViewEditLog}
      />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
