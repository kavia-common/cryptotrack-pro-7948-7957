import React, { useMemo } from 'react';

/**
 * Pagination - Prev/Next controls with range label and page size selector.
 * Props:
 *  - page (1-based)
 *  - pageSize
 *  - total (total items)
 *  - onPageChange(nextPage)
 *  - onPageSizeChange(nextSize)
 *  - pageSizeOptions (default [25,50,100])
 */

// PUBLIC_INTERFACE
export default function Pagination({
  page = 1,
  pageSize = 25,
  total = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
}) {
  /** Render pagination controls with disabled bounds. */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  const rangeLabel = useMemo(() => {
    if (total === 0) return '0–0 of 0';
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `${start}–${end} of ${total}`;
  }, [page, pageSize, total]);

  const goPrev = () => {
    if (!atStart) onPageChange?.(page - 1);
  };
  const goNext = () => {
    if (!atEnd) onPageChange?.(page + 1);
  };

  return (
    <div className="neon-pagination">
      <div className="muted">{rangeLabel}</div>
      <div className="row">
        <select
          className="select neon-page-select"
          aria-label="Rows per page"
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
        >
          {pageSizeOptions.map(s => <option key={s} value={s}>{s} / page</option>)}
        </select>
        <button
          className="icon-btn"
          aria-label="Previous page"
          onClick={goPrev}
          disabled={atStart}
          title="Previous"
        >
          ◀
        </button>
        <button
          className="icon-btn"
          aria-label="Next page"
          onClick={goNext}
          disabled={atEnd}
          title="Next"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
