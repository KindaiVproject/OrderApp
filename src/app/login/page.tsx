import { getSessionOrg } from "@/lib/auth";
import { redirect } from "next/navigation";
import AutoLogin from "./AutoLogin";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const { password } = await searchParams;

  if (!password) {
    const org = await getSessionOrg();
    if (org) redirect("/order");
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-lg font-semibold text-neutral-800">Order Management</h1>
      {password ? <AutoLogin password={password} /> : <LoginForm />}
    </div>
  );
}
