import { useT } from "../../lib/i18n";

type PaginationProps = {
  page: number;
  totalPages: number;
  disabled?: boolean;
  onChange: (page: number) => void;
  /**
   * When provided together with `onPageSizeChange`, the component renders a
   * "rows per page" selector before the page controls. Kept optional so
   * existing callers (which rely on a server-side default like 10) render
   * the classic prev/next-only pagination.
   */
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
};

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function Pagination({
  page,
  totalPages,
  disabled,
  onChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: PaginationProps) {
  const t = useT();
  const showPageSize = typeof pageSize === "number" && typeof onPageSizeChange === "function";

  // Hide the whole bar when there is nothing to paginate. Even if the caller
  // opted into the page-size selector, showing it alongside a single-page
  // result is noise — the user has fewer rows than the smallest option, so
  // changing the page size wouldn't change anything.
  if (totalPages <= 1) return null;

  const options = pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;

  return (
    <div className="pagination">
      {showPageSize ? (
        <label className="pagination-page-size">
          <span className="pagination-page-size-label">{t("common.pageSize")}</span>
          <select
            className="pagination-page-size-select"
            disabled={disabled}
            onChange={(event) => onPageSizeChange!(Number(event.target.value))}
            value={pageSize}
          >
            {options.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        className="btn btn-secondary btn-sm"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
        type="button"
      >
        {t("common.prev")}
      </button>
      <span className="pagination-info">
        {page} / {Math.max(totalPages, 1)}
      </span>
      <button
        className="btn btn-secondary btn-sm"
        disabled={disabled || page >= totalPages}
        onClick={() => onChange(page + 1)}
        type="button"
      >
        {t("common.next")}
      </button>
    </div>
  );
}
