// This app is for a Japan-based festival; timestamps must always read in
// JST regardless of the server's own timezone (Vercel functions run in
// UTC), so every display/grouping spot goes through these helpers instead
// of the Date object's local-timezone methods.
const TIME_ZONE = "Asia/Tokyo";

function jstParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  // Some environments render midnight as "24" under hour12: false.
  if (map.hour === "24") map.hour = "00";
  return map;
}

export function formatJstDateTime(date: Date): string {
  const p = jstParts(date);
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

export function formatJstTime(date: Date): string {
  const p = jstParts(date);
  return `${p.hour}:${p.minute}`;
}

// "YYYY-MM-DD", used as a stable grouping key.
export function formatJstDateKey(date: Date): string {
  const p = jstParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

// "MM/DD" for compact chart labels.
export function formatJstDateShort(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${month}/${day}`;
}

export function getJstHour(date: Date): number {
  return Number(jstParts(date).hour);
}
