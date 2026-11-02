import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Change } from "@/lib/revert";

// MEMBER summaries are written as "<who><suffix/marker>…". The edit-log page
// swaps <who> for the member's current name when rendering, so these strings
// must stay in sync with the writers (members API routes).
export const MEMBER_INVITE_SUFFIX = " を招待";
export const MEMBER_ROLE_MARKER = " の権限: ";

export type EditLogEntityType = "ORDER" | "PRODUCT" | "MEMBER" | "SHIFT" | "INSTANCE";
export type EditLogAction = "CREATE" | "EDIT" | "CANCEL" | "COMPLETE" | "DELETE" | "INVITE" | "REVERT";

export async function logEdit(params: {
  instanceId: string;
  entityType: EditLogEntityType;
  entityId: string;
  action: EditLogAction;
  summary: string;
  actorEmail: string | null | undefined;
  // Before/after states that make the entry revertable (see src/lib/revert.ts).
  changes?: Change[];
}) {
  await prisma.editLog.create({
    data: {
      instanceId: params.instanceId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      summary: params.summary,
      actorEmail: params.actorEmail ?? "unknown",
      ...(params.changes ? { changes: params.changes as unknown as Prisma.InputJsonValue } : {}),
    },
  });
}
