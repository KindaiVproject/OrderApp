// Browser-side QR reading for registering payment links. jsQR is loaded only
// when a scan starts, so pages that never scan do not download it.
async function decode(data: Uint8ClampedArray, width: number, height: number): Promise<string | null> {
  const { default: jsQR } = await import("jsqr");
  return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

// Longest side we hand to the decoder: big enough for a phone screenshot or
// photo of a QR, small enough to stay fast.
const MAX_SIDE = 1600;

export async function decodeQrFromFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  // Opaque white behind transparent PNGs, which would otherwise read as black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, width, height);
  return decode(data, width, height);
}

export async function decodeQrFromVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<string | null> {
  const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);
  if (!width || !height) return null;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return decode(data, width, height);
}
