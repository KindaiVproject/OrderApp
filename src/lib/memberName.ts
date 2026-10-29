import type { InstanceMemberModel, UserModel } from "@generated/prisma/models";

export type MemberWithUser = InstanceMemberModel & { user: UserModel | null };

// Admin-set per-instance name wins, then the name the person chose on their
// account page, then their Google account name, then the raw email as a last
// resort (e.g. invited but never signed in).
export function resolveName(
  email: string,
  memberDisplayName: string | null | undefined,
  user: { displayName: string | null; name: string | null } | null | undefined,
) {
  return memberDisplayName || user?.displayName || user?.name || email;
}

export function memberDisplayName(member: MemberWithUser) {
  return resolveName(member.email, member.displayName, member.user);
}
