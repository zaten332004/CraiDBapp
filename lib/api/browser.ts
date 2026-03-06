import { ApiFetchOptions, fetchJson } from "@/lib/api/shared";
import { getAccessToken } from "@/lib/auth/token";

/**
 * Browser-safe API helper that calls the Next.js proxy route (/api/v1),
 * so you don't need CORS and you don't expose server env vars to the client.
 */
export function browserApiFetch<T>(path: string, options?: ApiFetchOptions) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `/api/v1${cleanPath}`;
  return fetchJson<T>(url, options);
}

export function browserApiFetchAuth<T>(path: string, options: ApiFetchOptions = {}) {
  const token = getAccessToken();
  const headers = {
    ...(options.headers ?? {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  return browserApiFetch<T>(path, { ...options, headers });
}
