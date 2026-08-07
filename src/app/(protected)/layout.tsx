import Header from "@/components/Header";
import { getAdminEmail, requireCurrentInstance } from "@/lib/instance";
import { auth } from "@/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const instance = await requireCurrentInstance();
  const session = await auth();
  const isAdmin = session?.user?.email === getAdminEmail();

  return (
    <div className="flex min-h-dvh flex-col">
      <Header instanceName={instance.name} instanceLabel={instance.label} isAdmin={isAdmin} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
