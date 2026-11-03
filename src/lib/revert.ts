import type { Prisma } from "../../generated/prisma/client";
import type { OrderStatus, PaymentMethod } from "@generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// Undo for the edit log. A revertable entry stores, per entity it touched, the
// state before and after the change (`EditLog.changes`). Putting it back is:
// check the entity is still exactly in its "after" state (nobody changed it
// since), then write the "before" state. The revert is itself logged with the
// states swapped, so reverting a revert re-applies the original change.

export type RevertableType = "ORDER" | "PRODUCT" | "SHIFT";
export type Snapshot = Record<string, unknown>;
export type Change = { type: RevertableType; id: string; before: Snapshot | null; after: Snapshot | null };

type Db = Prisma.TransactionClient | typeof prisma;

// JSONB does not keep key order, so compare through a key-sorted form.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function sameState(a: Snapshot | null, b: Snapshot | null): boolean {
  return canonical(a) === canonical(b);
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function byKey<T>(rows: T[], key: (row: T) => string): T[] {
  return [...rows].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

// Current states of the given entities (missing ones are absent from the map).
// Scoped to the instance, so an id from another instance reads as missing.
export async function snapshotsOf(
  type: RevertableType,
  ids: string[],
  instanceId: string,
  db: Db = prisma,
): Promise<Map<string, Snapshot>> {
  const out = new Map<string, Snapshot>();
  if (ids.length === 0) return out;
  const where = { id: { in: ids }, instanceId };

  if (type === "ORDER") {
    const rows = await db.order.findMany({ where, include: { items: true } });
    for (const o of rows) {
      out.set(o.id, {
        status: o.status,
        paymentMethod: o.paymentMethod,
        customerNote: o.customerNote,
        createdAt: iso(o.createdAt),
        completedAt: iso(o.completedAt),
        items: byKey(
          o.items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            imageUrl: i.imageUrl,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            // Only when set, so orders nobody partially served look the same as
            // in edit-log entries recorded before this field existed.
            ...(i.servedQuantity > 0 ? { servedQuantity: i.servedQuantity } : {}),
          })),
          (i) => `${i.productName}\u0000${i.productId ?? ""}\u0000${i.unitPrice}\u0000${i.quantity}`,
        ),
      });
    }
  } else if (type === "PRODUCT") {
    const rows = await db.product.findMany({ where });
    for (const p of rows) {
      out.set(p.id, { name: p.name, price: p.price, imageUrl: p.imageUrl, sortOrder: p.sortOrder, active: p.active });
    }
  } else {
    const rows = await db.shift.findMany({ where, include: { assignments: true } });
    for (const s of rows) {
      out.set(s.id, {
        startsAt: iso(s.startsAt),
        endsAt: iso(s.endsAt),
        createdAt: iso(s.createdAt),
        assignments: byKey(
          s.assignments.map((a) => ({ memberId: a.memberId, role: a.role })),
          (a) => `${a.memberId}\u0000${a.role}`,
        ),
      });
    }
  }
  return out;
}

export async function snapshotOf(
  type: RevertableType,
  id: string,
  instanceId: string,
  db: Db = prisma,
): Promise<Snapshot | null> {
  return (await snapshotsOf(type, [id], instanceId, db)).get(id) ?? null;
}

export function change(
  type: RevertableType,
  id: string,
  before: Snapshot | null,
  after: Snapshot | null,
): Change {
  return { type, id, before, after };
}

type OrderState = {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  customerNote: string | null;
  createdAt: string;
  completedAt: string | null;
  items: {
    productId: string | null;
    productName: string;
    imageUrl: string | null;
    unitPrice: number;
    quantity: number;
    servedQuantity?: number;
  }[];
};
type ProductState = { name: string; price: number; imageUrl: string | null; sortOrder: number; active: boolean };
type ShiftState = { startsAt: string; endsAt: string; createdAt: string; assignments: { memberId: string; role: string }[] };

// Writes `target` (null = "does not exist") onto the entity. Returns how many
// shift assignments could not be restored because the person is no longer a
// member of the instance.
async function applyState(
  tx: Prisma.TransactionClient,
  instanceId: string,
  type: RevertableType,
  id: string,
  target: Snapshot | null,
): Promise<number> {
  if (type === "ORDER") {
    if (!target) {
      await tx.order.deleteMany({ where: { id, instanceId } });
      return 0;
    }
    const t = target as unknown as OrderState;
    // A product removed since then is only a dangling reference; keep the name snapshot.
    const known = new Set(
      (await tx.product.findMany({ where: { id: { in: t.items.flatMap((i) => (i.productId ? [i.productId] : [])) } }, select: { id: true } })).map((p) => p.id),
    );
    const items = t.items.map((i) => ({ ...i, productId: i.productId && known.has(i.productId) ? i.productId : null }));
    const data = {
      status: t.status,
      paymentMethod: t.paymentMethod,
      customerNote: t.customerNote,
      completedAt: t.completedAt ? new Date(t.completedAt) : null,
    };
    const exists = await tx.order.findFirst({ where: { id, instanceId }, select: { id: true } });
    if (exists) {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.order.update({ where: { id }, data: { ...data, items: { create: items } } });
    } else {
      await tx.order.create({
        data: { id, instanceId, createdAt: new Date(t.createdAt), ...data, items: { create: items } },
      });
    }
    return 0;
  }

  if (type === "PRODUCT") {
    // Products are never really deleted (orders and the CSV refer to them), so
    // "does not exist" means switched off.
    if (!target) {
      await tx.product.updateMany({ where: { id, instanceId }, data: { active: false } });
      return 0;
    }
    const t = target as unknown as ProductState;
    const exists = await tx.product.findFirst({ where: { id, instanceId }, select: { id: true } });
    if (exists) await tx.product.update({ where: { id }, data: t });
    else await tx.product.create({ data: { id, instanceId, ...t } });
    return 0;
  }

  if (!target) {
    await tx.shift.deleteMany({ where: { id, instanceId } });
    return 0;
  }
  const t = target as unknown as ShiftState;
  const startsAt = new Date(t.startsAt);
  const endsAt = new Date(t.endsAt);
  const members = new Set(
    (await tx.instanceMember.findMany({ where: { instanceId }, select: { id: true } })).map((m) => m.id),
  );
  const wanted = t.assignments.filter((a) => members.has(a.memberId));
  const skipped = t.assignments.length - wanted.length;

  const current = await tx.shift.findFirst({ where: { id, instanceId }, include: { assignments: true } });
  if (!current) {
    await tx.shift.create({
      data: { id, instanceId, startsAt, endsAt, createdAt: new Date(t.createdAt), assignments: { create: wanted } },
    });
    return skipped;
  }
  const retimed = current.startsAt.getTime() !== startsAt.getTime() || current.endsAt.getTime() !== endsAt.getTime();
  // Keep the people who stay (with their reminder marks, unless the time moved);
  // drop the rest and add the missing ones.
  const spare = [...current.assignments];
  const toCreate: { memberId: string; role: string }[] = [];
  for (const a of wanted) {
    const at = spare.findIndex((c) => c.memberId === a.memberId && c.role === a.role);
    if (at >= 0) spare.splice(at, 1);
    else toCreate.push(a);
  }
  const kept = current.assignments.filter((c) => !spare.includes(c));
  await tx.shiftAssignment.deleteMany({ where: { id: { in: spare.map((c) => c.id) } } });
  if (retimed && kept.length > 0) {
    await tx.shiftAssignment.updateMany({
      where: { id: { in: kept.map((c) => c.id) } },
      data: { beforeNotifiedAt: null, startNotifiedAt: null, calendarAddedAt: null },
    });
  }
  await tx.shift.update({ where: { id }, data: { startsAt, endsAt, assignments: { create: toCreate } } });
  return skipped;
}

function asChanges(value: unknown): Change[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value as Change[];
}

// For the edit-log page: which entries can still be reverted right now (every
// entity they touched is still in the state they left it in).
export async function revertableLogIds(
  logs: { id: string; changes: unknown }[],
  instanceId: string,
): Promise<Set<string>> {
  const idsByType: Record<RevertableType, Set<string>> = { ORDER: new Set(), PRODUCT: new Set(), SHIFT: new Set() };
  for (const log of logs) for (const c of asChanges(log.changes) ?? []) idsByType[c.type].add(c.id);
  const now = {
    ORDER: await snapshotsOf("ORDER", [...idsByType.ORDER], instanceId),
    PRODUCT: await snapshotsOf("PRODUCT", [...idsByType.PRODUCT], instanceId),
    SHIFT: await snapshotsOf("SHIFT", [...idsByType.SHIFT], instanceId),
  };
  const ok = new Set<string>();
  for (const log of logs) {
    const changes = asChanges(log.changes);
    if (changes && changes.every((c) => sameState(now[c.type].get(c.id) ?? null, c.after))) ok.add(log.id);
  }
  return ok;
}

export type RevertResult =
  | { ok: true; summary: string; skippedMembers: number }
  | { ok: false; status: number; error: string };

export async function revertLog(
  logId: string,
  instanceId: string,
  actorEmail: string | null | undefined,
): Promise<RevertResult> {
  const log = await prisma.editLog.findFirst({ where: { id: logId, instanceId } });
  const changes = log ? asChanges(log.changes) : null;
  if (!log || !changes) {
    return { ok: false, status: 400, error: "この履歴は取り消せません(取り消しに対応する前の記録です)" };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Still exactly as the change left it? Otherwise a later edit would be overwritten.
      for (const c of changes) {
        if (!sameState(await snapshotOf(c.type, c.id, instanceId, tx), c.after)) {
          throw new Conflict("この変更のあとに、同じ対象が別の操作で変更されています。新しい変更から順に取り消してください");
        }
      }
      let skippedMembers = 0;
      const reverted: Change[] = [];
      for (const c of changes) {
        skippedMembers += await applyState(tx, instanceId, c.type, c.id, c.before);
        // Log what actually resulted (a deleted product reads back as switched off).
        reverted.push(change(c.type, c.id, c.after, await snapshotOf(c.type, c.id, instanceId, tx)));
      }
      const wasRevert = log.action === "REVERT";
      const original = wasRevert ? log.summary.replace(/^取り消し: /, "") : log.summary;
      const summary = wasRevert ? `再適用: ${original}` : `取り消し: ${original}`;
      await tx.editLog.create({
        data: {
          instanceId,
          entityType: log.entityType,
          entityId: log.entityId,
          action: "REVERT",
          summary,
          actorEmail: actorEmail ?? "unknown",
          changes: reverted as unknown as Prisma.InputJsonValue,
        },
      });
      return { ok: true as const, summary, skippedMembers };
    });
  } catch (e) {
    if (e instanceof Conflict) return { ok: false, status: 409, error: e.message };
    throw e;
  }
}

class Conflict extends Error {}
