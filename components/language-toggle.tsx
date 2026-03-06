'use client';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n-provider';
import { type Locale, LOCALES } from '@/lib/i18n/dictionaries';

const labels: Record<Locale, string> = {
  vi: 'VI',
  en: 'EN',
};

export function LanguageToggle({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' }) {
  const { locale, setLocale } = useI18n();

  const next = (LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length] ?? 'vi') as Locale;

  return (
    <Button
      variant={variant}
      size="sm"
      className="font-semibold"
      aria-label="Toggle language"
      onClick={() => setLocale(next)}
    >
      {labels[locale]}
    </Button>
  );
}

