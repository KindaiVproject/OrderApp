import { prisma } from "@/lib/prisma";

export type EditLogEntityType = "ORDER" | "PRODUCT" | "MEMBER";
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
