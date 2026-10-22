import type { InstanceMemberModel, UserModel } from "@generated/prisma/models";

export type MemberWithUser = InstanceMemberModel & { user: UserModel | null };

// displayName (admin-set) wins, then the Google account name (once signed
// in), then the raw email as a last resort.
export function memberDisplayName(member: MemberWithUser) {
  return member.displayName ?? member.user?.name ?? member.email;
}
