import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function hashPassword(password: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Buffer.from(digest).toString("hex");
}

export async function findOrgByPassword(password: string) {
  const hashed = await hashPassword(password);
  return prisma.organization.findUnique({ where: { password: hashed } });
}

export async function getSessionOrg() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const orgId = await verifySession(token);
  if (!orgId) return null;
  return prisma.organization.findUnique({ where: { id: orgId } });
}

export async function requireOrg() {
  const org = await getSessionOrg();
  if (!org) redirect("/login");
  return org;
}
