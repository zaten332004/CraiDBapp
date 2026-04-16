import { clearSessionActivity, touchSessionActivity } from "@/lib/auth/session-activity";

const ACCESS_TOKEN_STORAGE_KEY = "accessToken";
const ACCESS_TOKEN_COOKIE_KEY = "access_token";
const USER_ROLE_STORAGE_KEY = "userRole";
const USER_ROLE_COOKIE_KEY = "user_role";
const USER_STATUS_STORAGE_KEY = "userStatus";
const USER_STATUS_COOKIE_KEY = "user_status";
const USER_HAS_PIN_STORAGE_KEY = "userHasPin";
const USER_HAS_PIN_COOKIE_KEY = "user_has_pin";
const USER_IS_ACTIVE_STORAGE_KEY = "userIsActive";
const USER_IS_ACTIVE_COOKIE_KEY = "user_is_active";

export type UserRole = "admin" | "manager" | "analyst" | "viewer";
export type UserStatus = "pending" | "approved" | "rejected";

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

function normalizeStatus(status: string | null | undefined): UserStatus | null {
  if (!status) return null;
  const value = String(status).trim().toLowerCase();
  if (value === "pending" || value === "approved" || value === "rejected") return value;
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

export function getUserStatus(): UserStatus | null {
  if (!isBrowser()) return null;
  return normalizeStatus(window.localStorage.getItem(USER_STATUS_STORAGE_KEY));
}

export function getUserHasPin(): boolean {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(USER_HAS_PIN_STORAGE_KEY) === "1";
}

export function getUserIsActive(): boolean | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(USER_IS_ACTIVE_STORAGE_KEY);
  if (raw === "1") return true;
  if (raw === "0") return false;
  return null;
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

export function setUserStatus(status: UserStatus) {
  if (!isBrowser()) return;
  window.localStorage.setItem(USER_STATUS_STORAGE_KEY, status);

  const secure = window.location.protocol === "https:";
  const attrs = [
    `${USER_STATUS_COOKIE_KEY}=${encodeURIComponent(status)}`,
    "Path=/",
    "SameSite=Lax",
    secure ? "Secure" : null,
  ].filter(Boolean);
  document.cookie = attrs.join("; ");
}

export function setUserHasPin(hasPin: boolean) {
  if (!isBrowser()) return;
  window.localStorage.setItem(USER_HAS_PIN_STORAGE_KEY, hasPin ? "1" : "0");

  const secure = window.location.protocol === "https:";
  const attrs = [
    `${USER_HAS_PIN_COOKIE_KEY}=${hasPin ? "1" : "0"}`,
    "Path=/",
    "SameSite=Lax",
    secure ? "Secure" : null,
  ].filter(Boolean);
  document.cookie = attrs.join("; ");
}

export function setUserIsActive(isActive: boolean) {
  if (!isBrowser()) return;
  window.localStorage.setItem(USER_IS_ACTIVE_STORAGE_KEY, isActive ? "1" : "0");

  const secure = window.location.protocol === "https:";
  const attrs = [
    `${USER_IS_ACTIVE_COOKIE_KEY}=${isActive ? "1" : "0"}`,
    "Path=/",
    "SameSite=Lax",
    secure ? "Secure" : null,
  ].filter(Boolean);
  document.cookie = attrs.join("; ");
}

export function setSession(args: {
  accessToken: string;
  role?: string | null;
  status?: string | null;
  hasPin?: boolean | null;
  isActive?: boolean | null;
}) {
  setAccessToken(args.accessToken);
  const role = normalizeRole(args.role);
  if (role) setUserRole(role);
  const status = normalizeStatus(args.status);
  if (status) setUserStatus(status);
  if (args.hasPin !== undefined && args.hasPin !== null) {
    setUserHasPin(Boolean(args.hasPin));
  }
  if (args.isActive !== undefined && args.isActive !== null) {
    setUserIsActive(Boolean(args.isActive));
  }
}

export function clearAccessToken() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_ROLE_STORAGE_KEY);
  window.localStorage.removeItem(USER_STATUS_STORAGE_KEY);
  window.localStorage.removeItem(USER_HAS_PIN_STORAGE_KEY);
  window.localStorage.removeItem(USER_IS_ACTIVE_STORAGE_KEY);
  clearSessionActivity();
  document.cookie = `${ACCESS_TOKEN_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${USER_ROLE_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${USER_STATUS_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${USER_HAS_PIN_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${USER_IS_ACTIVE_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
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
