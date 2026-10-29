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

// "abcdef@x.com" -> "a****f": only the part before "@", keeping the first and
// last character. Shorter locals reveal at most one character.
export function maskEmail(email: string): string {
  const local = email.split("@")[0];
  if (local.length <= 1) return "*";
  if (local.length === 2) return `${local[0]}*`;
  return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}`;
}

// Name shown on the shift screens. When nobody set a name (it would be the
// raw email) viewers who can't manage members only get the masked address.
export function shiftMemberName(member: MemberWithUser, canSeeAddresses: boolean): string {
  const name = memberDisplayName(member);
  if (name !== member.email || canSeeAddresses) return name;
  return maskEmail(member.email);
}
