// True on a desktop OS (Windows / macOS / Linux / ChromeOS) and false on
// phones and tablets (Android, iOS, iPadOS). Used to offer mouse-only
// interactions such as dragging bars on the schedule table. Client-only.
export function isDesktopOs(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return false;
  // iPadOS Safari reports itself as a Mac but has a touch screen.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return false;
  return /Windows|Macintosh|Linux|CrOS/.test(ua);
}
