"use client";

import { useState } from "react";

export const MAX_QUANTITY = 999;

// Full-width digits (typed with a Japanese keyboard) count too.
function digitsOnly(raw: string): string {
  return raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\D/g, "")
    .slice(0, 3);
}

// A number box for an order line's quantity, next to the −/+ buttons. A valid
// number applies as it is typed; leaving the box empty or at 0 takes the line
// out (like pressing − down to 0).
export default function QuantityInput({
  value,
  onChange,
  label,
  className = "",
}: {
  value: number;
  onChange: (quantity: number) => void;
  label: string;
  className?: string;
}) {
  // What is being typed, while the box has focus (so "" can be shown mid-edit).
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={label}
      value={draft ?? String(value)}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const next = digitsOnly(e.target.value);
        setDraft(next);
        const n = Number(next);
        if (next !== "" && n > 0) onChange(Math.min(MAX_QUANTITY, n));
      }}
      onBlur={() => {
        if (draft !== null && (draft === "" || Number(draft) === 0)) onChange(0);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={`rounded border border-neutral-300 text-center text-sm tabular-nums ${className}`}
    />
  );
}
