const LAST_ACTIVITY_KEY = "lastActivityAt";

export function touchSessionActivity() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function clearSessionActivity() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LAST_ACTIVITY_KEY);
}

export function getLastSessionActivity(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LAST_ACTIVITY_KEY);
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function isSessionIdleTooLong(maxIdleMs = 30 * 60 * 1000): boolean {
  const ts = getLastSessionActivity();
  if (!ts) return false;
  return Date.now() - ts > maxIdleMs;
}
