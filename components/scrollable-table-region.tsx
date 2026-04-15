'use client';

import { cn } from '@/lib/utils';

/**
 * Put on the header `TableRow` (inside `TableHeader`). Sticky is applied to each `th` so the row stays fixed
 * while `ScrollableTableRegion` scrolls; avoids nested `overflow-x` on the table wrapper breaking `position: sticky`.
 */
export const scrollableTableHeaderRowClass =
  'border-b border-border [&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-muted/95 dark:[&_th]:bg-[#3f4653] [&_th]:align-middle [&_th]:shadow-sm [&_th]:backdrop-blur-sm hover:[&_th]:bg-muted/90 dark:hover:[&_th]:bg-[#465060]';

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
        'min-h-0 max-h-[min(58vh,40rem,calc(100dvh-12rem))] overflow-y-auto overflow-x-auto overscroll-y-contain rounded-xl border border-border bg-card',
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
