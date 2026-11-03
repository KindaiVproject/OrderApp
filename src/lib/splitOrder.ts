import type { PaymentMethod } from "@generated/prisma/enums";
import type { OrderItemModel, OrderModel } from "@generated/prisma/models";
import { logEdit } from "@/lib/editLog";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment";
import { prisma } from "@/lib/prisma";
import { change, snapshotOf } from "@/lib/revert";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "PAYPAY", "D_PAYMENT"];

type SplitGroup = { paymentMethod: PaymentMethod; items: { itemId: string; quantity: number }[] };
type OrderWithItems = OrderModel & { items: OrderItemModel[] };

// Complete one order as several, one per payment method: "ラーメン3・ラムネ1" paid
// as cash for 1 ラーメン and PayPay for the rest becomes two completed orders.
// The original order keeps one group (the one with its payment method if there
// is one); the others are new orders with the same time and customer note.
export async function splitComplete(
  existing: OrderWithItems,
  input: unknown[],
  instanceId: string,
  actorEmail: string | null | undefined,
) {
  const bad = (error: string) => ({ ok: false as const, error });

  const byId = new Map(existing.items.map((i) => [i.id, i]));
  const groups: SplitGroup[] = [];
  const used = new Map<string, number>();
  for (const raw of input as { paymentMethod?: unknown; items?: unknown }[]) {
    const method = raw?.paymentMethod as PaymentMethod;
    if (!PAYMENT_METHODS.includes(method) || !Array.isArray(raw?.items)) return bad("分け方が正しくありません");
    if (groups.some((g) => g.paymentMethod === method)) return bad("同じ支払い方法が重複しています");
    const items: SplitGroup["items"] = [];
    for (const it of raw.items as { itemId?: unknown; quantity?: unknown }[]) {
      const quantity = Number(it?.quantity);
      if (typeof it?.itemId !== "string" || !byId.has(it.itemId) || !Number.isInteger(quantity) || quantity < 0) {
        return bad("分け方が正しくありません");
      }
      if (quantity === 0) continue;
      used.set(it.itemId, (used.get(it.itemId) ?? 0) + quantity);
      items.push({ itemId: it.itemId, quantity });
    }
    if (items.length > 0) groups.push({ paymentMethod: method, items });
  }
  // Every piece must be assigned exactly once.
  for (const item of existing.items) {
    if ((used.get(item.id) ?? 0) !== item.quantity) return bad("商品の個数が合っていません");
  }
  if (groups.length === 0) return bad("分け方が正しくありません");

  const keeperIndex = Math.max(0, groups.findIndex((g) => g.paymentMethod === existing.paymentMethod));
  const completedAt = new Date();
  const itemsOf = (g: SplitGroup) =>
    g.items.map(({ itemId, quantity }) => {
      const src = byId.get(itemId)!;
      return {
        productId: src.productId,
        productName: src.productName,
        imageUrl: src.imageUrl,
        unitPrice: src.unitPrice,
        quantity,
        servedQuantity: quantity,
      };
    });

  const before = await snapshotOf("ORDER", existing.id, instanceId);
  const newIds: string[] = [];
  const order = await prisma.$transaction(async (tx) => {
    const keeper = groups[keeperIndex];
    await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
    const kept = await tx.order.update({
      where: { id: existing.id },
      data: {
        status: "COMPLETED",
        completedAt,
        paymentMethod: keeper.paymentMethod,
        items: { create: itemsOf(keeper) },
      },
      include: { items: true },
    });
    for (const [i, g] of groups.entries()) {
      if (i === keeperIndex) continue;
      const created = await tx.order.create({
        data: {
          instanceId,
          customerNote: existing.customerNote,
          paymentMethod: g.paymentMethod,
          status: "COMPLETED",
          createdAt: existing.createdAt,
          completedAt,
          items: { create: itemsOf(g) },
        },
      });
      newIds.push(created.id);
    }
    return kept;
  });

  const describe = (g: SplitGroup) =>
    `${PAYMENT_METHOD_LABELS[g.paymentMethod]}[${g.items
      .map((i) => `${byId.get(i.itemId)!.productName}×${i.quantity}`)
      .join(", ")}]`;
  const afterSnapshots = await Promise.all(
    [existing.id, ...newIds].map(async (oid) => change("ORDER", oid, oid === existing.id ? before : null, await snapshotOf("ORDER", oid, instanceId))),
  );
  await logEdit({
    instanceId,
    entityType: "ORDER",
    entityId: existing.id,
    action: "COMPLETE",
    summary: `提供完了(支払い方法ごとに${groups.length}件の注文に分割: ${groups.map(describe).join(" / ")})`,
    actorEmail,
    changes: afterSnapshots,
  });

  return { ok: true as const, order };
}
