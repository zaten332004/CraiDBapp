import { ApiError, ApiFetchOptions, fetchJson } from "@/lib/api/shared";
import { getAccessToken } from "@/lib/auth/token";
import { logoutDueToSessionExpired } from "@/lib/auth/session-expired";

function isAuthPublicPath(cleanPath: string) {
  const p = cleanPath.toLowerCase();
  return (
    p.includes("/auth/login") ||
    p.includes("/auth/register") ||
    p.includes("/auth/forgot-password") ||
    p.includes("/auth/oauth") ||
    p.includes("/token")
  );
}

function looksLikeTokenSessionUnauthorized(err: ApiError): boolean {
  const raw = String(err.bodyText ?? "").trim().toLowerCase();
  if (!raw) return true;

  // Backends sometimes return 401 for permission errors (should be 403).
  // In that case we should show the API error, not force logout user.
  if (
    raw.includes("permission") ||
    raw.includes("forbidden") ||
    raw.includes("insufficient") ||
    raw.includes("not allowed") ||
    raw.includes("không có quyền") ||
    raw.includes("khong co quyen")
  ) {
    return false;
  }

  return (
    raw.includes("unauthorized") ||
    raw.includes("not authenticated") ||
    raw.includes("token") ||
    raw.includes("expired") ||
    raw.includes("invalid credentials") ||
    raw.includes("signature")
  );
}

/**
 * Browser-safe API helper that calls the Next.js proxy route (/api/v1),
 * so you don't need CORS and you don't expose server env vars to the client.
 */
export async function browserApiFetch<T>(path: string, options?: ApiFetchOptions) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `/api/v1${cleanPath}`;
  try {
    return await fetchJson<T>(url, options);
  } catch (e) {
    if (
      e instanceof ApiError &&
      e.status === 401 &&
      !isAuthPublicPath(cleanPath) &&
      getAccessToken() &&
      looksLikeTokenSessionUnauthorized(e)
    ) {
      logoutDueToSessionExpired("token");
    }
    throw e;
  }
}

export function browserApiFetchAuth<T>(path: string, options: ApiFetchOptions = {}) {
  const token = getAccessToken();
  const headers = {
    ...(options.headers ?? {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  return browserApiFetch<T>(path, { ...options, headers });
}
