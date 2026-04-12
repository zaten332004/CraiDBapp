"use client";

import * as React from "react";

import type { Locale } from "@/lib/i18n/dictionaries";
import { dictionaries, type Dictionary } from "@/lib/i18n/dictionaries";
import { LOCALE_COOKIE_KEY, normalizeLocale } from "@/lib/i18n/cookies";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = React.useState<Locale>(initialLocale);

  React.useEffect(() => {
    // In case user has an existing cookie, prefer it after hydration.
    const cookieLocale = normalizeLocale(
      document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${LOCALE_COOKIE_KEY}=`))
        ?.split("=")[1],
    );
    if (cookieLocale && cookieLocale !== locale) setLocaleState(cookieLocale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    const secure = window.location.protocol === "https:";
    const attrs = [
      `${LOCALE_COOKIE_KEY}=${encodeURIComponent(next)}`,
      "Path=/",
      "SameSite=Lax",
      secure ? "Secure" : null,
      "Max-Age=31536000",
    ].filter(Boolean);
    document.cookie = attrs.join("; ");
  }, []);

  const t = React.useCallback(
    (key: string) => {
      const dict = getDictionary(locale);
      return dict[key] ?? dictionaries.en[key] ?? key;
    },
    [locale],
  );

  const value = React.useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

