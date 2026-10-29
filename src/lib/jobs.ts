// Name under which the external shift-notification cron records its heartbeat
// (JobRun). Shared by the cron route and the /admin status card.
export const SHIFT_NOTIFY_JOB = "shift-notify";

// The scheduler runs every minute; a heartbeat older than this means it has
// stopped reaching the app.
export const JOB_STALE_MINUTES = 3;
