'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

type NavDirection = 'forward' | 'back';

declare global {
  // eslint-disable-next-line no-var
  var __CRAI_NAV_DIR__: NavDirection | undefined;
}

function getNavDirection(): NavDirection {
  if (typeof window === 'undefined') return 'forward';
  return window.__CRAI_NAV_DIR__ ?? 'forward';
}

function resetNavDirection() {
  if (typeof window === 'undefined') return;
  window.__CRAI_NAV_DIR__ = 'forward';
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const TRANSITION_MS = 560;

  const [outgoing, setOutgoing] = React.useState<React.ReactNode | null>(null);
  const [incoming, setIncoming] = React.useState<React.ReactNode | null>(null);
  const [stable, setStable] = React.useState<React.ReactNode>(children);
  const [direction, setDirection] = React.useState<NavDirection>('forward');

  const lastPathnameRef = React.useRef(pathname);
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    // Same route: allow normal re-render without animation (locale/theme changes, etc.).
    if (pathname === lastPathnameRef.current) {
      setStable(children);
      return;
    }

    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

    const dir = getNavDirection();
    setDirection(dir);
    resetNavDirection();

    setOutgoing(stable);
    setIncoming(children);

    lastPathnameRef.current = pathname;

    timeoutRef.current = window.setTimeout(() => {
      setStable(children);
      setOutgoing(null);
      setIncoming(null);
      timeoutRef.current = null;
    }, TRANSITION_MS);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const enterClass = direction === 'back' ? 'route-enter-back' : 'route-enter-forward';
  const exitClass = direction === 'back' ? 'route-exit-back' : 'route-exit-forward';
  const isTransitioning = Boolean(outgoing || incoming);

  return (
    <div className="route-transition-root">
      {isTransitioning && <div className="route-dim" aria-hidden />}
      {outgoing && (
        <div className={`route-layer ${exitClass}`} aria-hidden>
          {outgoing}
        </div>
      )}
      <div className={`route-layer ${incoming ? enterClass : 'page-transition'}`}>
        {incoming ?? stable}
      </div>
    </div>
  );
}
