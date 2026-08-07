import Header from "@/components/Header";
import { requireOrg } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const org = await requireOrg();

  return (
    <div className="flex min-h-dvh flex-col">
      <Header orgLabel={org.label} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
