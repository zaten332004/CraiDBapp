'use client';

import * as React from 'react';

type NavDirection = 'forward' | 'back';

declare global {
  // eslint-disable-next-line no-var
  var __CRAI_NAV_DIR__: NavDirection | undefined;
}

function setNavDirection(dir: NavDirection) {
  window.__CRAI_NAV_DIR__ = dir;
}

function isPlainLeftClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

function findAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest('a[href]');
}

function isInternalNavigation(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute('href');
  if (!href) return false;
  if (href.startsWith('#')) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;

  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function RouteTransitionListener() {
  React.useEffect(() => {
    setNavDirection('forward');

    const onPopState = () => {
      setNavDirection('back');
      // Reset after the transition has a chance to read it.
      window.setTimeout(() => setNavDirection('forward'), 0);
    };

    const onClickCapture = (e: MouseEvent) => {
      if (!isPlainLeftClick(e)) return;

      const anchor = findAnchor(e.target);
      if (!anchor) return;
      if (!isInternalNavigation(anchor)) return;

      const requested = anchor.dataset.navDir;
      if (requested === 'back' || requested === 'forward') {
        setNavDirection(requested);
      } else {
        setNavDirection('forward');
      }
    };

    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onClickCapture, true);

    return () => {
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  return null;
}
