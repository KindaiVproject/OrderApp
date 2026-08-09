import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function extensionForMime(mime: string): string | null {
  return EXTENSION_BY_MIME[mime] ?? null;
}

// A product's imageUrl must be either a bundled default (shipped in
// public/defaults) or a URL we got back from our own Vercel Blob upload —
// never an arbitrary external URL, to keep <img src> scoped to content
// this app controls.
export function isValidProductImagePath(value: string): boolean {
  if (/^\/defaults\/products\/[a-zA-Z0-9._-]+$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function saveProductImage(buffer: Buffer, mime: string): Promise<string> {
  const ext = extensionForMime(mime);
  if (!ext) throw new Error("unsupported image type");

  const blob = await put(`products/${randomUUID()}.${ext}`, buffer, {
    access: "public",
    contentType: mime,
  });

  return blob.url;
}
