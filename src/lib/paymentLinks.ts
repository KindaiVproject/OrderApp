export type PaymentLinkKind = "paypay" | "dpayment";

export const PAYMENT_LINK_KINDS: { kind: PaymentLinkKind; label: string; field: "paypayUrl" | "dPaymentUrl" }[] = [
  { kind: "paypay", label: "PayPay", field: "paypayUrl" },
  { kind: "dpayment", label: "d払い", field: "dPaymentUrl" },
];

export const PAYMENT_LINK_MAX_LENGTH = 500;

// Empty = unregister. Only https links are accepted, so a stray "javascript:"
// or plain-http address can never end up behind a QR code or a link.
export function normalizePaymentLink(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (text === "") return "";
  if (text.length > PAYMENT_LINK_MAX_LENGTH) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return text;
}
