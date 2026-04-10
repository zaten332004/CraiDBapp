import { clearSessionActivity, touchSessionActivity } from "@/lib/auth/session-activity";

const ACCESS_TOKEN_STORAGE_KEY = "accessToken";
const ACCESS_TOKEN_COOKIE_KEY = "access_token";
const USER_ROLE_STORAGE_KEY = "userRole";
const USER_ROLE_COOKIE_KEY = "user_role";

export type UserRole = "admin" | "manager" | "analyst" | "viewer";

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function normalizeRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;
  const value = String(role).trim().toLowerCase();
  if (value === "admin" || value === "manager" || value === "analyst" || value === "viewer") {
    return value;
  }
  return null;
}

export function getAccessToken() {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function getUserRole(): UserRole | null {
  if (!isBrowser()) return null;
  return normalizeRole(window.localStorage.getItem(USER_ROLE_STORAGE_KEY));
}

export function setAccessToken(token: string) {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  touchSessionActivity();

  const secure = window.location.protocol === "https:";
  const attrs = [
    `${ACCESS_TOKEN_COOKIE_KEY}=${encodeURIComponent(token)}`,
    "Path=/",
    "SameSite=Lax",
    secure ? "Secure" : null,
  ].filter(Boolean);
  document.cookie = attrs.join("; ");
}

export function setUserRole(role: UserRole) {
  if (!isBrowser()) return;
  window.localStorage.setItem(USER_ROLE_STORAGE_KEY, role);

  const secure = window.location.protocol === "https:";
  const attrs = [
    `${USER_ROLE_COOKIE_KEY}=${encodeURIComponent(role)}`,
    "Path=/",
    "SameSite=Lax",
    secure ? "Secure" : null,
  ].filter(Boolean);
  document.cookie = attrs.join("; ");
}

export function setSession(args: { accessToken: string; role?: string | null }) {
  setAccessToken(args.accessToken);
  const role = normalizeRole(args.role);
  if (role) setUserRole(role);
}

export function clearAccessToken() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_ROLE_STORAGE_KEY);
  clearSessionActivity();
  document.cookie = `${ACCESS_TOKEN_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${USER_ROLE_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function authJsonHeaders(extra?: Record<string, string>) {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

export function authHeaders(extra?: Record<string, string>) {
  const token = getAccessToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}
