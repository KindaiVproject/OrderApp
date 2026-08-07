import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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

// A product's imageUrl must point at an image we (or a chosen default) put
// on disk — never an arbitrary external URL, to keep <img src> scoped to
// content this server controls.
export function isValidProductImagePath(value: string): boolean {
  return /^\/(uploads\/products|defaults\/products)\/[a-zA-Z0-9._-]+$/.test(value);
}

// Saved under public/uploads/products so Next.js serves it directly at
// /uploads/products/<file>. Note: on a serverless/ephemeral deploy (e.g.
// Vercel) this directory does not persist across deploys or instances —
// swap for object storage (Vercel Blob, S3, etc.) before going back there.
export async function saveProductImage(buffer: Buffer, mime: string): Promise<string> {
  const ext = extensionForMime(mime);
  if (!ext) throw new Error("unsupported image type");

  const dir = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads", "products");
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(/* turbopackIgnore: true */ dir, filename), buffer);

  return `/uploads/products/${filename}`;
}
