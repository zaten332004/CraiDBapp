'use client';

import { cn } from '@/lib/utils';

/**
 * Merges into the first `TableRow` inside `TableHeader` so column titles stay visible while the body scrolls.
 */
export const scrollableTableHeaderRowClass =
  'sticky top-0 z-[1] border-b border-border bg-muted/95 shadow-sm backdrop-blur-sm hover:bg-muted/90';

/** Wraps wide data tables: caps height and scrolls inside so long lists do not stretch the whole dashboard. */
export function ScrollableTableRegion({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'max-h-[min(68vh,40rem)] overflow-y-auto overflow-x-auto overscroll-y-contain rounded-xl border border-border bg-card',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Non-table lists (cards, stacks): same height cap, vertical scroll; use `className` to soften border inside a Card. */
export function ScrollableListRegion({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'max-h-[min(68vh,40rem)] min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-lg border border-border bg-card/60',
        className,
      )}
    >
      {children}
    </div>
  );
}
