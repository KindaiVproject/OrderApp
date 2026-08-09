// Splits on any mix of commas and whitespace (spaces, tabs, newlines),
// so "a@x.com, b@x.com  c@x.com,,d@x.com" all parse correctly.
export function parseEmailList(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of text.split(/[\s,]+/)) {
    const email = raw.trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }
  return result;
}
