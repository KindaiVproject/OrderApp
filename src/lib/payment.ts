import type { PaymentMethod } from "@generated/prisma/enums";

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "現金/金券" },
  { value: "PAYPAY", label: "PayPay" },
  { value: "D_PAYMENT", label: "d払い" },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "現金/金券",
  PAYPAY: "PayPay",
  D_PAYMENT: "d払い",
};
