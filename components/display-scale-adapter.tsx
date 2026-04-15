'use client';

import { useEffect } from 'react';

function uiScaleFromDevicePixelRatio(dpr: number): number {
  if (!Number.isFinite(dpr) || dpr <= 1.05) return 1;
  if (dpr <= 1.2) return 0.96;
  if (dpr <= 1.35) return 0.92;
  if (dpr <= 1.55) return 0.88;
  return 0.85;
}

/**
 * Windows display scale (125%, 150%, etc.) increases devicePixelRatio.
 * We adapt root typography density so wide dashboard tables still fit.
 */
export function DisplayScaleAdapter() {
  useEffect(() => {
    const root = document.documentElement;

    const applyScale = () => {
      const dpr = window.devicePixelRatio || 1;
      const scale = uiScaleFromDevicePixelRatio(dpr);
      root.style.setProperty('--display-scale-adjust', String(scale));
    };

    applyScale();
    window.addEventListener('resize', applyScale);
    return () => {
      window.removeEventListener('resize', applyScale);
    };
  }, []);

  return null;
}

