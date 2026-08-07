import Link from "next/link";
import { getAdminEmail, getMyInstances, requireSession } from "@/lib/instance";
import InstancePicker from "./InstancePicker";

export default async function InstancesPage() {
  const session = await requireSession();
  const instances = await getMyInstances();
  const isAdmin = session.user!.email === getAdminEmail();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="text-base font-semibold text-neutral-800">インスタンスを選択</h1>
      <p className="text-xs text-neutral-500">{session.user!.email} でログイン中</p>

      <InstancePicker instances={instances} />

      {isAdmin && (
        <Link href="/admin" className="text-center text-xs text-neutral-500 underline">
          インスタンス管理(Admin)
        </Link>
      )}
    </div>
  );
}
