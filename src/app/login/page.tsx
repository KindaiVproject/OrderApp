import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import GoogleSignInButton from "./GoogleSignInButton";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/instances");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-neutral-800">
        <Image src="/logo.svg" alt="" width={28} height={28} className="rounded-[6px]" />
        注文管理
      </h1>
      <GoogleSignInButton />
      <p className="max-w-xs text-center text-xs text-neutral-400">
        Googleアカウントでログインし、招待されたインスタンスを選択してください。
      </p>
    </div>
  );
}
