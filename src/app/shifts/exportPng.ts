import { assignLanes, hhmm, type ScheduleLayout, type ScheduleMode } from "./scheduleLayout";
import { dateLabel, roleHex, type RoleColors } from "./shiftTypes";

// Draws one day of the schedule table onto a canvas and downloads it as a PNG.
// Hand-drawn (no html-to-image) so it needs no extra library and works with
// the browser's own Japanese fonts; avatars are loaded with CORS and fall back
// to an initial letter if the image can't be used.

const SCALE = 2;
const PAD = 24;
const HEAD_H = 64;
const AXIS_H = 32;
const LABEL_W = 156;
const HOUR_W = 168;
const LANE_H = 64;
const INSET = 6;
const MIN_BAR_W = 168;
const FONT = '"Hiragino Sans", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif';

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 5000);
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  name: string,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = "#e5e5e5";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "#737373";
    ctx.font = `700 ${Math.round(r * 1.1)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.trim().charAt(0).toUpperCase() || "?", cx, cy + 1);
  }
  ctx.restore();
}

export async function renderSchedulePng(opts: {
  layout: ScheduleLayout;
  mode: ScheduleMode;
  date: string;
  title: string;
  roleColors: RoleColors;
}): Promise<HTMLCanvasElement> {
  const { layout, mode, date, title, roleColors } = opts;
  const { rows, axisStart, axisEnd } = layout;
  const span = axisEnd - axisStart;
  const hours = span / 60;
  const minMinutes = Math.ceil((MIN_BAR_W / HOUR_W) * 60);
  const laid = rows.map((row) => ({ row, ...assignLanes(row.bars, minMinutes) }));

  // The track grows if a minimum-width bar pokes past the last hour.
  let trackW = hours * HOUR_W;
  for (const { placed } of laid) {
    for (const { bar } of placed) {
      const left = ((bar.start - axisStart) / span) * hours * HOUR_W;
      trackW = Math.max(trackW, left + Math.max(((bar.end - bar.start) / 60) * HOUR_W, MIN_BAR_W));
    }
  }

  const bodyH = laid.reduce((sum, l) => sum + l.lanes * LANE_H, 0) || LANE_H;
  const width = PAD * 2 + LABEL_W + trackW;
  const height = PAD * 2 + HEAD_H + AXIS_H + bodyH;

  const urls = [...new Set(rows.flatMap((r) => [r.image, ...r.bars.map((b) => b.image)]).filter((u): u is string => Boolean(u)))];
  const loaded = new Map<string, HTMLImageElement | null>();
  await Promise.all(urls.map(async (u) => loaded.set(u, await loadImage(u))));

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * SCALE);
  canvas.height = Math.ceil(height * SCALE);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#171717";
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(`${title} シフト表`, PAD, PAD + 24);
  ctx.fillStyle = "#737373";
  ctx.font = `500 14px ${FONT}`;
  ctx.fillText(`${dateLabel(date)}(${mode === "role" ? "役割ごと" : "人ごと"})`, PAD, PAD + 48);

  const gridTop = PAD + HEAD_H;
  const trackX = PAD + LABEL_W;
  const bottom = gridTop + AXIS_H + bodyH;

  // Axis + vertical hour lines
  ctx.font = `500 12px ${FONT}`;
  ctx.textBaseline = "middle";
  for (let h = 0; h <= hours; h++) {
    const x = trackX + h * HOUR_W;
    ctx.strokeStyle = "#e5e5e5";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, gridTop + AXIS_H);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    if (h < hours) {
      ctx.fillStyle = "#737373";
      ctx.textAlign = "left";
      ctx.fillText(hhmm(axisStart + h * 60), x + 4, gridTop + AXIS_H / 2);
    }
  }
  ctx.strokeStyle = "#d4d4d4";
  ctx.beginPath();
  ctx.moveTo(PAD, gridTop + AXIS_H);
  ctx.lineTo(trackX + trackW, gridTop + AXIS_H);
  ctx.stroke();

  // Rows
  let y = gridTop + AXIS_H;
  for (const { row, placed, lanes } of laid) {
    const rowH = lanes * LANE_H;
    ctx.strokeStyle = "#f0f0f0";
    ctx.beginPath();
    ctx.moveTo(PAD, y + rowH);
    ctx.lineTo(trackX + trackW, y + rowH);
    ctx.stroke();

    // Row label
    const midY = y + rowH / 2;
    if (mode === "role") {
      const hex = roleHex(row.roleName!, roleColors);
      ctx.font = `700 14px ${FONT}`;
      const text = fitText(ctx, row.roleName!, LABEL_W - 28);
      const w = ctx.measureText(text).width + 16;
      ctx.fillStyle = hex.bg;
      roundRect(ctx, PAD, midY - 14, w, 28, 6);
      ctx.fill();
      ctx.fillStyle = hex.text;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, PAD + 8, midY + 1);
    } else {
      drawAvatar(ctx, row.image ? loaded.get(row.image) ?? null : null, row.personName!, PAD + 14, midY, 14);
      ctx.fillStyle = "#262626";
      ctx.font = `${row.isMe ? 700 : 500} 13px ${FONT}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(fitText(ctx, row.personName!, LABEL_W - 40), PAD + 36, row.unapproved ? midY - 7 : midY);
      if (row.unapproved) {
        ctx.fillStyle = "#b45309";
        ctx.font = `700 10px ${FONT}`;
        ctx.fillText("未承認ユーザー", PAD + 36, midY + 9);
      }
    }

    // Bars
    for (const { bar, lane } of placed) {
      const hex = roleHex(bar.roleName, roleColors);
      const x = trackX + ((bar.start - axisStart) / span) * hours * HOUR_W;
      const w = Math.max(((bar.end - bar.start) / 60) * HOUR_W, MIN_BAR_W);
      const by = y + lane * LANE_H + INSET;
      const bh = LANE_H - INSET * 2;
      ctx.fillStyle = hex.bg;
      roundRect(ctx, x + 1, by, w - 2, bh, 8);
      ctx.fill();
      ctx.strokeStyle = bar.mine ? "#60a5fa" : hex.line;
      ctx.lineWidth = bar.mine ? 2.5 : 1;
      ctx.stroke();
      ctx.lineWidth = 1;

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      let tx = x + 10;
      let textW = w - 20;
      if (mode === "role") {
        drawAvatar(ctx, bar.image ? loaded.get(bar.image) ?? null : null, bar.personName, x + 10 + 11, by + bh / 2, 11);
        tx += 28;
        textW -= 28;
      }
      ctx.fillStyle = hex.text;
      ctx.font = `700 13px ${FONT}`;
      ctx.fillText(fitText(ctx, mode === "role" ? bar.personName : bar.roleName, textW), tx, by + bh / 2 - 8);
      ctx.font = `500 11px ${FONT}`;
      ctx.globalAlpha = 0.75;
      ctx.fillText(`${hhmm(bar.start)}〜${hhmm(bar.end)}`, tx, by + bh / 2 + 9);
      ctx.globalAlpha = 1;
    }
    y += rowH;
  }

  if (rows.length === 0) {
    ctx.fillStyle = "#a3a3a3";
    ctx.font = `500 13px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText("この日は担当者が未設定です", PAD, gridTop + AXIS_H + LANE_H / 2);
  }
  return canvas;
}

async function schedulePngBlob(opts: Parameters<typeof renderSchedulePng>[0]): Promise<Blob> {
  const canvas = await renderSchedulePng(opts);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("画像を作成できませんでした");
  return blob;
}

export async function downloadSchedulePng(opts: Parameters<typeof renderSchedulePng>[0]) {
  const blob = await schedulePngBlob(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shift-${opts.date}-${opts.mode === "role" ? "role" : "person"}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Whether this browser can put an image on the clipboard (needs HTTPS or
// localhost, the async Clipboard API and ClipboardItem).
export function canCopyImage(): boolean {
  return typeof ClipboardItem !== "undefined" && typeof navigator !== "undefined" && Boolean(navigator.clipboard?.write);
}

// Copies the same PNG to the clipboard so it can be pasted straight into a chat
// or doc. The ClipboardItem takes a *promise* of the blob: it is created inside
// the click handler (keeping the user gesture alive, which Safari insists on)
// while the canvas is still being drawn.
export async function copySchedulePng(opts: Parameters<typeof renderSchedulePng>[0]) {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": schedulePngBlob(opts) })]);
}
