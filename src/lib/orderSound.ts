// The chime the kitchen screen plays when a new order arrives. The sounds are
// synthesized with the Web Audio API, so there are no audio files to host and
// nothing to license. The choice lives on the device (localStorage): a kitchen
// tablet and a phone want different things.

export type OrderSoundId = "none" | "chime" | "bell" | "beep";

export const ORDER_SOUNDS: { id: OrderSoundId; label: string; note: string }[] = [
  { id: "chime", label: "ピンポン", note: "やわらかい2音のチャイム" },
  { id: "bell", label: "ベル", note: "余韻のあるベルの音" },
  { id: "beep", label: "ピピピ", note: "騒がしい場所でも届く電子音" },
  { id: "none", label: "鳴らさない", note: "" },
];

export type OrderSoundSettings = { id: OrderSoundId; volume: number };

export const DEFAULT_ORDER_SOUND: OrderSoundSettings = { id: "chime", volume: 0.8 };

const STORAGE_KEY = "orderapp.orderSound";

function isSoundId(v: unknown): v is OrderSoundId {
  return ORDER_SOUNDS.some((s) => s.id === v);
}

function parse(raw: string | null): OrderSoundSettings {
  if (!raw) return DEFAULT_ORDER_SOUND;
  try {
    const parsed = JSON.parse(raw);
    const volume = typeof parsed?.volume === "number" ? Math.min(1, Math.max(0, parsed.volume)) : 0.8;
    return { id: isSoundId(parsed?.id) ? parsed.id : DEFAULT_ORDER_SOUND.id, volume };
  } catch {
    return DEFAULT_ORDER_SOUND;
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// useSyncExternalStore wiring: the snapshot must be the same object until the
// stored value changes, and the server (no localStorage) renders the default.
let cached: { raw: string | null; value: OrderSoundSettings } | null = null;
const listeners = new Set<() => void>();

export function getOrderSoundSnapshot(): OrderSoundSettings {
  const raw = readRaw();
  if (!cached || cached.raw !== raw) cached = { raw, value: parse(raw) };
  return cached.value;
}

export function getOrderSoundServerSnapshot(): OrderSoundSettings {
  return DEFAULT_ORDER_SOUND;
}

export function subscribeOrderSound(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function saveOrderSound(settings: OrderSoundSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage blocked (private mode etc.): the choice just won't persist
  }
  // Fall back to remembering it for this page view when storage is unavailable.
  cached = { raw: readRaw(), value: settings };
  listeners.forEach((l) => l());
}

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (context) return context;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

// Browsers keep audio muted until the person has touched the page, so this is
// called from a tap/click. Returns whether sound can play now.
export async function unlockAudio(): Promise<boolean> {
  const ctx = getContext();
  if (!ctx) return false;
  if (ctx.state !== "running") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  return ctx.state === "running";
}

export function isAudioRunning(): boolean {
  return context?.state === "running";
}

export function onAudioStateChange(listener: () => void): () => void {
  const ctx = getContext();
  if (!ctx) return () => {};
  ctx.addEventListener("statechange", listener);
  return () => ctx.removeEventListener("statechange", listener);
}

type Tone = { freq: number; at: number; length: number; type?: OscillatorType; peak?: number };

function schedule(ctx: AudioContext, out: AudioNode, tones: Tone[]) {
  const now = ctx.currentTime;
  for (const t of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + t.at;
    const peak = t.peak ?? 0.5;
    osc.type = t.type ?? "sine";
    osc.frequency.value = t.freq;
    // Short attack, exponential decay: avoids clicks and sounds like a struck note.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + t.length);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + t.length + 0.05);
  }
}

const PATTERNS: Record<Exclude<OrderSoundId, "none">, Tone[]> = {
  // Two soft notes, high then low: "ピンポーン".
  chime: [
    { freq: 880, at: 0, length: 0.7, peak: 0.55 },
    { freq: 659.25, at: 0.28, length: 1.1, peak: 0.55 },
  ],
  // A struck bell: a fundamental plus inharmonic partials that die away at different speeds.
  bell: [
    { freq: 1046.5, at: 0, length: 1.8, peak: 0.45 },
    { freq: 2093, at: 0, length: 1.1, peak: 0.2 },
    { freq: 2877.9, at: 0, length: 0.7, peak: 0.12 },
    { freq: 5651, at: 0, length: 0.35, peak: 0.06 },
  ],
  // Three short electronic beeps; cuts through kitchen noise.
  beep: [0, 0.2, 0.4].map((at) => ({ freq: 1568, at, length: 0.12, type: "square" as const, peak: 0.25 })),
};

// Plays the chosen sound. `volume` is 0–1. Does nothing if audio is locked or
// the sound is "none"; returns whether something was scheduled.
export function playOrderSound(id: OrderSoundId, volume: number): boolean {
  if (id === "none") return false;
  const ctx = getContext();
  if (!ctx || ctx.state !== "running") return false;
  const master = ctx.createGain();
  master.gain.value = Math.min(1, Math.max(0, volume));
  master.connect(ctx.destination);
  schedule(ctx, master, PATTERNS[id]);
  return true;
}
