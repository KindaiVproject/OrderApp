// "その他のQR" on /payment: extra QR codes (a form, a LINE account, a shop page…)
// next to PayPay / d払い. Each has a label and an https link.
export const OTHER_QR_LABEL_MAX = 40;
export const OTHER_QR_MAX_COUNT = 20;

// Null when empty or too long.
export function normalizeOtherQrLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (text === "" || text.length > OTHER_QR_LABEL_MAX) return null;
  return text;
}
