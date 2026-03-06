import "server-only";

import { ApiFetchOptions, fetchJson, joinUrl } from "@/lib/api/shared";
import { cookies } from "next/headers";

function getServerBaseUrl() {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing API_BASE_URL. Add it to .env.local (see .env.example).");
  }
  return baseUrl;
}

export function serverApiFetch<T>(path: string, options?: ApiFetchOptions) {
  const url = joinUrl(getServerBaseUrl(), path);
  return fetchJson<T>(url, options);
}

export async function serverApiFetchAuth<T>(path: string, options: ApiFetchOptions = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  const headers = {
    ...(options.headers ?? {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  return serverApiFetch<T>(path, { ...options, headers });
}
