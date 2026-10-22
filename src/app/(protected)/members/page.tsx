import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageMembers, requireCurrentInstance } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import MembersClient from "./MembersClient";

export default async function MembersPage() {
  const instance = await requireCurrentInstance();
  const session = await auth();
  const email = session?.user?.email;
  if (!(await canManageMembers(instance.id, email))) redirect("/order");

  const members = await prisma.instanceMember.findMany({
    where: { instanceId: instance.id },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return <MembersClient instanceId={instance.id} initialMembers={members} currentEmail={email ?? ""} />;
}
