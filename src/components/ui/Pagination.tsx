import { useT } from "../../lib/i18n";

type PaginationProps = {
  page: number;
  totalPages: number;
  disabled?: boolean;
  onChange: (page: number) => void;
};

export function Pagination({ page, totalPages, disabled, onChange }: PaginationProps) {
  const t = useT();
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button
        className="btn btn-secondary btn-sm"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
        type="button"
      >
        {t("common.prev")}
      </button>
      <span className="pagination-info">
        {page} / {totalPages}
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
