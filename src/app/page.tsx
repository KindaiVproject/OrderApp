import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentInstance } from "@/lib/instance";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const instance = await getCurrentInstance();
  redirect(instance ? "/order" : "/instances");
}
