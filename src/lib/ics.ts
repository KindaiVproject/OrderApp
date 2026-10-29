// A minimal iCalendar (.ics) writer — enough for a list of all-day-less events.
// Every calendar app (Google, Apple, Outlook, Android) can import the result.

export type IcsEvent = {
  // Stable per event: re-importing the same UID updates the event instead of
  // adding a duplicate.
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
};

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function escapeText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Lines are limited to 75 octets; longer ones continue on a line starting with
// a space. Folding is by octets but never splits a (multi-byte) character.
function fold(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > 75) {
      parts.push(current);
      current = ` ${ch}`;
      bytes = 1 + size;
    } else {
      current += ch;
      bytes += size;
    }
  }
  parts.push(current);
  return parts.join("\r\n");
}

export function buildIcs(events: IcsEvent[], now: Date = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OrderApp//Shifts//JA", "CALSCALE:GREGORIAN", "X-WR-CALNAME:シフト"];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${utc(now)}`,
      `DTSTART:${utc(e.start)}`,
      `DTEND:${utc(e.end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
