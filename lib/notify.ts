'use client';

import { Info } from 'lucide-react';
import { createElement } from 'react';
import { toast } from 'sonner';
import { getApiErrorToastParts, type UserFacingLocale } from '@/lib/api/format-api-error';

/** Một kiểu toast duy nhất (thẻ + icon trái): hiển thị vài giây rồi mờ dần (Sonner + globals.css). */
const DEFAULT_MS = 4200;
/** Lỗi có mô tả (API) — vừa đủ đọc bản tóm tắt */
export const TOAST_ERROR_DETAIL_MS = 5200;

const ERROR_DESCRIPTION_MAX_CHARS = 200;

/** Gộp xuống một dòng và cắt bớt để toast không kéo dài. */
export function shortenToastDescription(text: string, max = ERROR_DESCRIPTION_MAX_CHARS): string {
  const one = text.replace(/\s*\n+\s*/g, " · ").replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  const slice = one.slice(0, max);
  const sp = slice.lastIndexOf(" ");
  const head = sp > Math.floor(max * 0.55) ? slice.slice(0, sp) : slice;
  return `${head.trimEnd()}…`;
}

/** Tránh lặp cùng một thông báo (Strict Mode, gọi kép, v.v.) */
const DEDUPE_MS = 2800;
let lastToastKey = '';
let lastToastAt = 0;

function shouldSkipDuplicateToast(key: string): boolean {
  const now = Date.now();
  if (key === lastToastKey && now - lastToastAt < DEDUPE_MS) {
    return true;
  }
  lastToastKey = key;
  lastToastAt = now;
  return false;
}

export type NotifyVariant = 'success' | 'error' | 'neutral';
type NotifyDetails = string | string[];

function formatDescription(description?: string, details?: NotifyDetails) {
  const lines: string[] = [];
  if (description?.trim()) lines.push(description.trim());
  if (typeof details === 'string' && details.trim()) lines.push(details.trim());
  if (Array.isArray(details)) {
    for (const item of details) {
      const value = String(item || '').trim();
      if (value) lines.push(`- ${value}`);
    }
  }
  return lines.length ? lines.join('\n') : undefined;
}

export function notify(
  message: string,
  options?: { description?: string; details?: NotifyDetails; variant?: NotifyVariant; duration?: number },
) {
  const variant = options?.variant ?? 'neutral';
  const duration = options?.duration ?? DEFAULT_MS;
  let description = formatDescription(options?.description, options?.details);
  if (variant === 'error' && description) {
    description = shortenToastDescription(description);
  }
  const common = { duration, description: description || undefined };

  const dedupeKey = `${variant}|${message}|${description ?? ''}`;
  if (shouldSkipDuplicateToast(dedupeKey)) {
    return;
  }

  if (variant === 'success') {
    toast.success(message, common);
    return;
  }
  if (variant === 'error') {
    toast.error(message, common);
    return;
  }

  toast(message, {
    ...common,
    icon: createElement(Info, {
      className: 'size-4 shrink-0 text-muted-foreground',
      strokeWidth: 2,
      'aria-hidden': true,
    }),
  });
}

export function notifySuccess(message: string, descriptionOrOptions?: string | { description?: string; details?: NotifyDetails; duration?: number }) {
  if (typeof descriptionOrOptions === 'string' || descriptionOrOptions == null) {
    notify(message, { variant: 'success', description: descriptionOrOptions });
    return;
  }
  notify(message, { variant: 'success', ...descriptionOrOptions });
}

export function notifyError(message: string, descriptionOrOptions?: string | { description?: string; details?: NotifyDetails; duration?: number }) {
  if (typeof descriptionOrOptions === 'string' || descriptionOrOptions == null) {
    const d = descriptionOrOptions;
    notify(message, {
      variant: 'error',
      description: d,
      duration: d?.trim() ? TOAST_ERROR_DETAIL_MS : DEFAULT_MS,
    });
    return;
  }
  const duration =
    descriptionOrOptions.duration ??
    (descriptionOrOptions.description || descriptionOrOptions.details ? TOAST_ERROR_DETAIL_MS : DEFAULT_MS);
  notify(message, { variant: 'error', ...descriptionOrOptions, duration });
}

/** Error toast with a specific title from HTTP status / validation (not generic “Action failed”). */
export function notifyApiError(err: unknown, locale: UserFacingLocale) {
  const { title, description } = getApiErrorToastParts(err, locale);
  const d = shortenToastDescription(description.trim());
  notifyError(title, {
    description: d || undefined,
    duration: d ? TOAST_ERROR_DETAIL_MS : DEFAULT_MS,
  });
}

/** Cùng khung với success/error; chỉ khác màu chữ/icon trung tính. */
export function notifyInfo(message: string, descriptionOrOptions?: string | { description?: string; details?: NotifyDetails; duration?: number }) {
  if (typeof descriptionOrOptions === 'string' || descriptionOrOptions == null) {
    notify(message, { variant: 'neutral', description: descriptionOrOptions });
    return;
  }
  notify(message, { variant: 'neutral', ...descriptionOrOptions });
}
