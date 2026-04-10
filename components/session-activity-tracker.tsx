'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { touchSessionActivity, isSessionIdleTooLong } from '@/lib/auth/session-activity';
import { getAccessToken } from '@/lib/auth/token';
import { logoutDueToSessionExpired } from '@/lib/auth/session-expired';
import { useI18n } from '@/components/i18n-provider';

const EVENTS: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];

const IDLE_CHECK_MS = 15_000;

function idleLimitMs() {
  const minutes = Number(process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES);
  const m = Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
  return m * 60 * 1000;
}

export function SessionActivityTracker() {
  const pathname = usePathname() ?? '';
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    const handler = () => touchSessionActivity();
    handler();
    EVENTS.forEach((evt) => window.addEventListener(evt, handler, { passive: true }));
    return () => {
      EVENTS.forEach((evt) => window.removeEventListener(evt, handler));
    };
  }, []);

  useEffect(() => {
    const runCheck = () => {
      if (!getAccessToken()) return;
      if (pathname.startsWith('/auth')) return;
      if (!isSessionIdleTooLong(idleLimitMs())) return;
      logoutDueToSessionExpired('idle', { message: tRef.current('session.expired_idle') });
    };

    const interval = window.setInterval(runCheck, IDLE_CHECK_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') runCheck();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pathname]);

  return null;
}
