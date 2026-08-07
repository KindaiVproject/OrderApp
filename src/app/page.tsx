import { redirect } from "next/navigation";
import { getSessionOrg } from "@/lib/auth";

export default async function Home() {
  const org = await getSessionOrg();
  redirect(org ? "/order" : "/login");
}
