import Link from "next/link";
import { getMyInstances, isAdminEmail, requireSession } from "@/lib/instance";
import InstancePicker from "./InstancePicker";
import LogoutButton from "./LogoutButton";

const LINK_CLASS =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-center text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50";

export default async function InstancesPage() {
  const session = await requireSession();
  const instances = await getMyInstances();
  const isAdmin = await isAdminEmail(session.user!.email);
  const hasOpenable = instances.some((i) => i.active);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col p-4">
      {/* my-auto centers a short page but, unlike justify-center, lets a long
          instance list grow downward and scroll instead of clipping the top. */}
      <div className="my-auto flex flex-col gap-4">
        <h1 className="text-base font-semibold text-neutral-800">インスタンスを選択</h1>
        <p className="text-xs text-neutral-500">{session.user!.email} でログイン中</p>

        <InstancePicker instances={instances} />

        <div className="flex flex-col gap-2">
          {hasOpenable && (
            <Link href="/shifts" className={LINK_CLASS}>
              自分のシフトを見る
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin" className={LINK_CLASS}>
              インスタンス管理(Admin)
            </Link>
          )}
          <Link href="/account" className={LINK_CLASS}>
            アカウント設定
          </Link>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
