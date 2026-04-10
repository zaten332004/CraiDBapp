'use client';

import { Button } from '@/components/ui/button';

type ListPaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  className?: string;
};

function buildPages(page: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  if (page <= 3) return [1, 2, 3, 4, 'ellipsis', totalPages];
  if (page >= totalPages - 2) return [1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', totalPages];
}

export function ListPagination({ page, totalPages, onPageChange, className }: ListPaginationProps) {
  if (totalPages <= 1) return null;
  const pages = buildPages(page, totalPages);

  return (
    <div className={className ?? 'mt-4 flex items-center justify-end gap-1'}>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        {'<'}
      </Button>

      {pages.map((item, idx) =>
        item === 'ellipsis' ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-xs text-muted-foreground">
            ...
          </span>
        ) : (
          <Button
            key={item}
            size="icon"
            variant={item === page ? 'secondary' : 'ghost'}
            className="h-8 w-8"
            onClick={() => onPageChange(item)}
            aria-label={`Page ${item}`}
          >
            {item}
          </Button>
        ),
      )}

      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        {'>'}
      </Button>
    </div>
  );
}
