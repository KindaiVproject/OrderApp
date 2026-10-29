import InstanceHeader from "@/components/InstanceHeader";
import { requireCurrentInstance } from "@/lib/instance";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const instance = await requireCurrentInstance();

  return (
    <div className="flex flex-1 flex-col">
      <InstanceHeader instance={instance} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
