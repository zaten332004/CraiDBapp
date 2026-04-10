const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function safeDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // Backend often returns naive UTC timestamps (no timezone suffix).
  // Treat those as UTC explicitly to avoid displaying raw UTC as local time.
  const hasTimezone = /(?:z|[+-]\d{2}:\d{2})$/i.test(raw);
  const normalized = hasTimezone ? raw : `${raw.replace(' ', 'T')}Z`;

  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTimeVietnam(value: unknown, locale: string = 'vi'): string {
  const d = safeDate(value);
  if (!d) return '-';
  const language = locale === 'vi' ? 'vi-VN' : 'en-GB';
  return d.toLocaleString(language, {
    hour12: false,
    timeZone: VIETNAM_TIME_ZONE,
  });
}

export function formatDateVietnam(value: unknown, locale: string = 'vi', opts?: Intl.DateTimeFormatOptions): string {
  const d = safeDate(value);
  if (!d) return '-';
  const language = locale === 'vi' ? 'vi-VN' : 'en-US';
  return d.toLocaleDateString(language, {
    timeZone: VIETNAM_TIME_ZONE,
    ...(opts ?? {}),
  });
}

