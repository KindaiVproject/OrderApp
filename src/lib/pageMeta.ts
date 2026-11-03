import dns from "node:dns";
import https from "node:https";
import net from "node:net";
import { OTHER_QR_LABEL_MAX } from "@/lib/otherQr";

// Reads a web page's title from its metadata, to suggest a label for a QR code.
// The address comes from a form, so the request is locked down: https on the
// default port only, no private/internal addresses (checked when connecting,
// so a DNS answer cannot swap one in), a few redirects, a small body, a short
// timeout.

const MAX_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5000;

function isPrivateIPv4(ip: string): boolean {
  const [a, b, c] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (!net.isIPv6(ip)) return true;
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb") ||
    lower.startsWith("ff") ||
    lower.startsWith("::ffff:")
  );
}

function checkedUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (url.port !== "" && url.port !== "443") return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isPrivateAddress(host)) return null;
  return url;
}

// Runs on every connection, so the address that is actually connected to is
// the one that gets checked.
const safeLookup = ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err, address, family);
    const list = Array.isArray(address) ? address : [{ address, family }];
    if (list.some((a) => isPrivateAddress(a.address))) return callback(new Error("blocked address"));
    callback(null, address, family);
  });
}) as unknown as net.LookupFunction;

type Page = { html: string };

function fetchOnce(url: URL): Promise<{ redirect: string } | Page | null> {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; OrderAppLabelBot/1.0)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ja,en;q=0.8",
          "Accept-Encoding": "identity",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          resolve({ redirect: new URL(res.headers.location, url).toString() });
          return;
        }
        const type = String(res.headers["content-type"] ?? "");
        if (status < 200 || status >= 300 || (type && !/html|xml/i.test(type))) {
          res.resume();
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          size += chunk.length;
          if (size >= MAX_BYTES) res.destroy();
        });
        const done = () => resolve({ html: decodeHtml(Buffer.concat(chunks), type) });
        res.on("end", done);
        res.on("close", done);
        res.on("error", () => resolve(null));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.on("error", () => resolve(null));
  });
}

// Honors the charset of the header or <meta>, so Shift_JIS / EUC-JP pages are
// not garbled.
function decodeHtml(body: Buffer, contentType: string): string {
  let charset = contentType.match(/charset=["']?([\w-]+)/i)?.[1];
  if (!charset) {
    const head = body.subarray(0, 2048).toString("latin1");
    charset = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  }
  try {
    return new TextDecoder(charset ?? "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return String.fromCodePoint(code);
      } catch {
        return m;
      }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function clean(text: string | undefined): string {
  return decodeEntities(text ?? "").replace(/\s+/g, " ").trim();
}

export function parseTitle(html: string): { title: string; siteName: string } {
  const metas = new Map<string, string>();
  for (const tag of html.match(/<meta\s[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
    }
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (key && attrs.content !== undefined && !metas.has(key)) metas.set(key, attrs.content);
  }
  const pageTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return {
    title: clean(metas.get("og:title") ?? metas.get("twitter:title") ?? pageTitle),
    siteName: clean(metas.get("og:site_name")),
  };
}

// Label suggested for the page at `raw`. `fromPage` is false when the page
// could not be read (or had no title) and the domain name is used instead.
// Null only when `raw` is not an acceptable address.
export async function suggestLabel(raw: string): Promise<{ label: string; fromPage: boolean } | null> {
  let url = checkedUrl(raw);
  if (!url) return null;
  const host = url.hostname;
  for (let i = 0; i <= MAX_REDIRECTS && url; i++) {
    const result = await fetchOnce(url);
    if (!result) break;
    if ("redirect" in result) {
      url = checkedUrl(result.redirect);
      continue;
    }
    const { title, siteName } = parseTitle(result.html);
    const label = (title || siteName).slice(0, OTHER_QR_LABEL_MAX);
    if (label) return { label, fromPage: true };
    break;
  }
  return { label: host.slice(0, OTHER_QR_LABEL_MAX), fromPage: false };
}
