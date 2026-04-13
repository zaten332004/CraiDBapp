import type { MouseEventHandler, PointerEventHandler } from 'react';

const MOVE_THRESHOLD_PX = 8;

const ATTR_X = 'data-rownav-x';
const ATTR_Y = 'data-rownav-y';

/** Clicks on these targets should not trigger row navigation (copy text, controls, links). */
const INTERACTIVE_SELECTOR =
  'a,button,input,select,textarea,[role="button"],[role="menuitem"],[role="switch"],[role="checkbox"],[role="tab"],label[for],[data-no-row-nav]';

/**
 * Handlers for list rows / cards: run {@link onActivate} only on a simple click,
 * not when the pointer moved enough to suggest drag-to-select, and not when
 * there is a text selection inside the row.
 */
export function rowNavigationPointerHandlers(onActivate: () => void): {
  onPointerDown: PointerEventHandler<HTMLElement>;
  onClick: MouseEventHandler<HTMLElement>;
} {
  return {
    onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const el = e.currentTarget;
      el.setAttribute(ATTR_X, String(e.clientX));
      el.setAttribute(ATTR_Y, String(e.clientY));
    },
    onClick(e) {
      const el = e.currentTarget;
      const sx = Number(el.getAttribute(ATTR_X));
      const sy = Number(el.getAttribute(ATTR_Y));
      el.removeAttribute(ATTR_X);
      el.removeAttribute(ATTR_Y);

      const target = e.target as HTMLElement | null;
      if (target?.closest?.(INTERACTIVE_SELECTOR)) return;
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;

      const dx = Math.abs(e.clientX - sx);
      const dy = Math.abs(e.clientY - sy);
      if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) return;

      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      const text = sel?.toString()?.trim() ?? '';
      if (text.length > 0 && sel && sel.rangeCount > 0) {
        try {
          if (sel.getRangeAt(0).intersectsNode(el)) return;
        } catch {
          return;
        }
      }

      onActivate();
    },
  };
}
