// The chime the kitchen screen plays when a new order arrives. The sounds are
// synthesized with the Web Audio API, so there are no audio files to host and
// nothing to license.

export type OrderSoundId = "none" | "chime" | "bell" | "beep";

export const ORDER_SOUNDS: { id: OrderSoundId; label: string; note: string }[] = [
  { id: "chime", label: "ピンポン", note: "やわらかい2音のチャイム" },
  { id: "bell", label: "ベル", note: "余韻のあるベルの音" },
  { id: "beep", label: "ピピピ", note: "騒がしい場所でも届く電子音" },
  { id: "none", label: "鳴らさない", note: "" },
];

export const DEFAULT_ORDER_SOUND_ID: OrderSoundId = "chime";

export function isOrderSoundId(v: unknown): v is OrderSoundId {
  return ORDER_SOUNDS.some((s) => s.id === v);
}

// Which sound rings is the instance's setting (Instance.orderSound, shared by
// everyone in it). The volume and the read-aloud switch depend on the device
// (its speaker, its voices), so they stay on the device.
const DEFAULT_VOLUME = 0.8;
const VOLUME_KEY = "orderapp.orderSoundVolume";
const SPEECH_KEY = "orderapp.orderSpeech";
// Both device settings share one listener set; a change re-checks both snapshots.
const volumeListeners = new Set<() => void>();

export function getVolumeSnapshot(): number {
  try {
    const n = Number(localStorage.getItem(VOLUME_KEY));
    return localStorage.getItem(VOLUME_KEY) === null || Number.isNaN(n)
      ? DEFAULT_VOLUME
      : Math.min(1, Math.max(0, n));
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function getVolumeServerSnapshot(): number {
  return DEFAULT_VOLUME;
}

export function subscribeVolume(listener: () => void): () => void {
  volumeListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    volumeListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function saveVolume(volume: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // storage blocked (private mode etc.): the volume just won't persist
  }
  volumeListeners.forEach((l) => l());
}

export function getSpeechSnapshot(): boolean {
  try {
    return localStorage.getItem(SPEECH_KEY) === "1";
  } catch {
    return false;
  }
}

export function getSpeechServerSnapshot(): boolean {
  return false;
}

export const subscribeSpeech = subscribeVolume;

export function saveSpeech(on: boolean) {
  try {
    localStorage.setItem(SPEECH_KEY, on ? "1" : "0");
  } catch {
    // storage blocked: the switch just won't persist
  }
  volumeListeners.forEach((l) => l());
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
  unlockSpeech();
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

// --- Reading the order aloud (optional) ---

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

// Like audio, speech can be blocked until the page has been touched; a silent
// utterance from a tap lifts that.
function unlockSpeech() {
  if (!speechSupported()) return;
  const u = new SpeechSynthesisUtterance("");
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

type SpokenItem = { productName: string; quantity: number };

// "たこ焼き 3個、ラムネ 1個"
export function orderSpeechText(items: SpokenItem[]): string {
  return items.map((i) => `${i.productName} ${i.quantity}個`).join("、");
}

// How long each chime lasts, so the voice starts after it instead of over it.
const CHIME_MS: Record<OrderSoundId, number> = { none: 0, chime: 1300, bell: 1500, beep: 700 };

// Queues one utterance per order (the browser reads them one after another).
// `afterSound` waits for the chime to finish first.
export function speakOrders(orders: SpokenItem[][], volume: number, afterSound: OrderSoundId) {
  if (!speechSupported() || volume <= 0) return;
  const speak = () => {
    for (const items of orders) {
      const u = new SpeechSynthesisUtterance(orderSpeechText(items));
      u.lang = "ja-JP";
      u.volume = Math.min(1, Math.max(0, volume));
      window.speechSynthesis.speak(u);
    }
  };
  const wait = CHIME_MS[afterSound];
  if (wait > 0 && volume > 0) setTimeout(speak, wait);
  else speak();
}
