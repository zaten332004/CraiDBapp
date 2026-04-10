import { notifyError, notifyInfo } from '@/lib/notify';
import { clearAccessToken, getAccessToken } from '@/lib/auth/token';
let logoutInProgress = false;

function detectLocale(): 'vi' | 'en' {
  if (typeof document === 'undefined') return 'en';
  const lang = (document.documentElement.lang || '').toLowerCase();
  return lang.startsWith('vi') ? 'vi' : 'en';
}

const COPY = {
  idle: { vi: 'Phiên đã hết hạn do không hoạt động lâu. Vui lòng đăng nhập lại.', en: 'Your session expired due to inactivity. Please sign in again.' },
  token: { vi: 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.', en: 'Your session is no longer valid. Please sign in again.' },
} as const;

/**
 * Clears session, shows one toast, full redirect to login (middleware + cookie sync).
 * Safe to call from intervals, 401 handlers, visibility checks.
 */
export function logoutDueToSessionExpired(
  reason: 'idle' | 'token',
  options?: { message?: string },
) {
  if (typeof window === 'undefined') return;
  if (logoutInProgress) return;
  if (!getAccessToken()) return;

  logoutInProgress = true;
  clearAccessToken();

  const locale = detectLocale();
  const message =
    options?.message?.trim() ||
    (reason === 'idle' ? COPY.idle[locale] : COPY.token[locale]);

  if (reason === 'token') {
    notifyError(message, { duration: 6200 });
  } else {
    notifyInfo(message, { duration: 5200 });
  }

  const path = `${window.location.pathname}${window.location.search || ''}`;
  const next =
    path.startsWith('/dashboard') && !path.startsWith('/dashboard/forbidden') ? path : '';
  const qs = new URLSearchParams();
  qs.set('reason', reason === 'idle' ? 'session_idle' : 'session_invalid');
  if (next) qs.set('next', next);
  window.location.assign(`/auth/login?${qs.toString()}`);
}
