import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const CURRENT_INSTANCE_COOKIE = "current_instance_id";

export function getAdminEmail() {
  return process.env.ADMIN_EMAIL ?? "dolonaand@gmail.com";
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user!.email !== getAdminEmail()) redirect("/instances");
  return session;
}

// Instances the signed-in Google account has been invited to.
export async function getMyInstances() {
  const session = await auth();
  if (!session?.user?.email) return [];
  const memberships = await prisma.instanceMember.findMany({
    where: { email: session.user.email },
    include: { instance: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => m.instance);
}

export async function getCurrentInstance() {
  const session = await auth();
  if (!session?.user?.email) return null;

  const instanceId = (await cookies()).get(CURRENT_INSTANCE_COOKIE)?.value;
  if (!instanceId) return null;

  const membership = await prisma.instanceMember.findUnique({
    where: { instanceId_email: { instanceId, email: session.user.email } },
    include: { instance: true },
  });
  if (!membership || !membership.instance.active) return null;
  return membership.instance;
}

export async function requireCurrentInstance() {
  await requireSession();
  const instance = await getCurrentInstance();
  if (!instance) redirect("/instances");
  return instance;
}
