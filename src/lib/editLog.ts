import { prisma } from "@/lib/prisma";

// MEMBER summaries are written as "<who><suffix/marker>…". The edit-log page
// swaps <who> for the member's current name when rendering, so these strings
// must stay in sync with the writers (members API routes).
export const MEMBER_INVITE_SUFFIX = " を招待";
export const MEMBER_ROLE_MARKER = " の権限: ";

export type EditLogEntityType = "ORDER" | "PRODUCT" | "MEMBER" | "SHIFT";
export type EditLogAction = "CREATE" | "EDIT" | "CANCEL" | "COMPLETE" | "DELETE" | "INVITE";

export async function logEdit(params: {
  instanceId: string;
  entityType: EditLogEntityType;
  entityId: string;
  action: EditLogAction;
  summary: string;
  actorEmail: string | null | undefined;
}) {
  await prisma.editLog.create({
    data: {
      instanceId: params.instanceId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      summary: params.summary,
      actorEmail: params.actorEmail ?? "unknown",
    },
  });
}
