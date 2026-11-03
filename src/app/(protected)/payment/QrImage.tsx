export type LinkInfo = { kind: string; label: string; url: string; qr: string | null };

// Each method gets its own accent and initial so the two codes are told apart
// at a glance.
export const ACCENTS: Record<string, string> = { paypay: "#e11d48", dpayment: "#ea580c" };
const INITIALS: Record<string, string> = { paypay: "P", dpayment: "d" };
export const DEFAULT_ACCENT = "#171717";

// The badge in the middle is just the service's initial in a gothic (sans-serif)
// face: plain text, not the companies' logos, which are trademarks with usage
// rules. It covers about 4% of the code, well inside what error-correction
// level H can lose. Sizes use container units so it scales with the zoomed
// view too.
export default function QrImage({ src, kind, label, className }: { src: string; kind: string; label: string; className: string }) {
  const accent = ACCENTS[kind] ?? DEFAULT_ACCENT;
  return (
    <span className={`@container relative block aspect-square ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${label}のQR`} className="size-full [image-rendering:pixelated]" />
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 flex aspect-square w-[20%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[3cqw] bg-white font-bold leading-none"
        style={{
          boxShadow: `inset 0 0 0 1cqw ${accent}`,
          color: accent,
          fontSize: "13cqw",
          fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Noto Sans JP", Meiryo, sans-serif',
        }}
      >
        {INITIALS[kind] ?? label.slice(0, 1)}
      </span>
    </span>
  );
}
