/**
 * Countdown timer formatting: seconds padded to two digits plus tenths.
 * Examples: 65432ms -> "65.4", 9812ms -> "09.8", 0 -> "00.0".
 */
export function formatTimeMs(ms: number): string {
  const clamped = Math.max(0, ms);
  const tenths = Math.floor(clamped / 100);
  const secs = Math.floor(tenths / 10);
  const frac = tenths % 10;
  return `${String(secs).padStart(2, '0')}.${frac}`;
}

/** Format a completed run time for results, e.g. "34.72s". */
export function formatRunTime(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(2)}s`;
}
