"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";

export type PickerOption = { id: string; name: string; image: string | null; unapproved?: boolean };

// Replaces the native <select> for choosing a person, so each option carries
// the member's icon. `inline` opens the list in the flow (for use inside the
// scrolling modal); otherwise it floats under the button.
export default function MemberPicker({
  options,
  value,
  onChange,
  placeholder,
  emptyLabel,
  inline = false,
  ariaLabel,
}: {
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  // When set, a first entry that clears the selection (e.g. "全員").
  emptyLabel?: string;
  inline?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
  }

  const itemClass = (active: boolean) =>
    `flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-neutral-100 ${
      active ? "bg-neutral-50 font-semibold" : ""
    }`;

  return (
    <div ref={ref} className={`relative min-w-0 ${inline ? "flex-1" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex w-full items-center gap-2 rounded border border-neutral-300 bg-white px-2 py-1.5 text-left text-sm"
      >
        {selected ? (
          <>
            <Avatar name={selected.name} image={selected.image} size={20} />
            <span className="min-w-0 flex-1 truncate text-neutral-800">{selected.name}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-neutral-500">{value === "" && emptyLabel ? emptyLabel : placeholder}</span>
        )}
        <span aria-hidden className="text-[10px] text-neutral-400">
          ▼
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className={`z-40 mt-1 max-h-60 overflow-y-auto rounded border border-neutral-200 bg-white py-1 shadow-lg ${
            inline ? "" : "absolute left-0 min-w-full"
          }`}
        >
          {emptyLabel && (
            <li>
              <button type="button" role="option" aria-selected={value === ""} onClick={() => choose("")} className={itemClass(value === "")}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] text-neutral-500">
                  全
                </span>
                {emptyLabel}
              </button>
            </li>
          )}
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === value}
                onClick={() => choose(o.id)}
                className={itemClass(o.id === value)}
              >
                <Avatar name={o.name} image={o.image} size={22} />
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                {o.unapproved && (
                  <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-700">
                    未承認
                  </span>
                )}
              </button>
            </li>
          ))}
          {options.length === 0 && <li className="px-2 py-1.5 text-xs text-neutral-400">選べる人がいません</li>}
        </ul>
      )}
    </div>
  );
}
