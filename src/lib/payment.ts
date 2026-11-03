import type { PaymentMethod } from "@generated/prisma/enums";

// What can be picked when taking or completing an order.
export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "現金/金券" },
  { value: "PAYPAY", label: "PayPay" },
  { value: "D_PAYMENT", label: "d払い" },
];

// 不明 can only be set afterwards, from the history edit, for a completed order
// whose payment method can no longer be told.
export const UNKNOWN_PAYMENT_OPTION: { value: PaymentMethod; label: string } = { value: "UNKNOWN", label: "不明" };

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "現金/金券",
  PAYPAY: "PayPay",
  D_PAYMENT: "d払い",
  UNKNOWN: "不明",
};
