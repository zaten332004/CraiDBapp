import type { Locale } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/dictionaries";

export const LOCALE_COOKIE_KEY = "locale";

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  return isLocale(v) ? v : null;
}

