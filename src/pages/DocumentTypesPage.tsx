import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type AriaAttributes,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { DocumentTypeFormModal } from "../components/modals/DocumentTypeFormModal";
import { PageToolbar } from "../components/layout/PageToolbar";
import { FilterIcon, PencilIcon } from "../components/icons";
import { ColumnPicker } from "../components/ui/ColumnPicker";
import { Pagination } from "../components/ui/Pagination";
import { SearchInput } from "../components/ui/SearchInput";
import { StatusPill } from "../components/ui/StatusPill";
import { TableHeaderFilter } from "../components/ui/TableHeaderFilter";
import { useToast } from "../components/ui/Toast";
import { getDocumentTypes } from "../lib/documents-api";
import { useT } from "../lib/i18n";
import type { DocumentTypeResponse } from "../lib/types";
import { useColumnVisibility } from "../lib/use-column-visibility";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;

type DocumentTypeSortField = "name" | "isRequired" | "isActive";
type DocumentTypeColumnId = DocumentTypeSortField;
type SortDirection = "asc" | "desc";
type SortState = { field: DocumentTypeSortField; direction: SortDirection } | null;
type DocumentTypeFilters = {
  name: string;
  required: "all" | "required" | "optional";
  activity: "all" | "active" | "inactive";
};
type DocumentTypeColumnDef = {
  id: DocumentTypeColumnId;
  label: string;
  sortField: DocumentTypeSortField;
  renderCell: (item: DocumentTypeResponse) => ReactNode;
  skeletonWidth: number;
  skeletonKind?: "line" | "pill";
};

const DOCUMENT_TYPE_COLUMN_IDS: DocumentTypeColumnId[] = [
  "name",
  "isRequired",
  "isActive",
];

const DEFAULT_FILTERS: DocumentTypeFilters = {
  name: "",
  required: "all",
  activity: "all",
};

type DocumentTypesPageProps = {
  embedded?: boolean;
};

function buildColumns(t: ReturnType<typeof useT>): DocumentTypeColumnDef[] {
  return [
    {
      id: "name",
      label: t("documentTypes.col.name"),
      sortField: "name",
      renderCell: (item) => <strong>{item.name}</strong>,
      skeletonWidth: 160,
    },
    {
      id: "isRequired",
      label: t("documentTypes.col.required"),
      sortField: "isRequired",
      renderCell: (item) =>
        item.isRequired ? t("documentTypes.required.short") : t("documentTypes.notRequired.short"),
      skeletonWidth: 42,
    },
    {
      id: "isActive",
      label: t("documentTypes.col.active"),
      sortField: "isActive",
      renderCell: (item) => (
        <StatusPill
          label={item.isActive ? t("documentTypes.active") : t("documentTypes.inactive")}
          status={item.isActive ? "success" : "manual"}
        />
      ),
      skeletonWidth: 56,
      skeletonKind: "pill",
    },
  ];
}

export function DocumentTypesPage({ embedded = false }: DocumentTypesPageProps) {
  const t = useT();
  const { showToast } = useToast();
  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    "settings.document-types.columns.v1",
    DOCUMENT_TYPE_COLUMN_IDS
  );

  const [items, setItems] = useState<DocumentTypeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sort, setSort] = useState<SortState>(null);
  const [search, setSearch] = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [filters, setFilters] = useState<DocumentTypeFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTypeResponse | null>(null);
  const columns = buildColumns(t);
  const visibleColumns = columns.filter((column) => isVisible(column.id));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    getDocumentTypes({ includeInactive }, controller.signal)
      .then(setItems)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast(t("documentTypes.loadFailed"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [includeInactive, refreshKey, showToast, t]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    const name = filters.name.trim().toLocaleLowerCase("tr-TR");

    return items.filter((item) => {
      if (query) {
        const haystack = item.name.toLocaleLowerCase("tr-TR");
        if (!haystack.includes(query)) return false;
      }
      if (name && !item.name.toLocaleLowerCase("tr-TR").includes(name)) return false;
      if (filters.required === "required" && !item.isRequired) return false;
      if (filters.required === "optional" && item.isRequired) return false;
      if (filters.activity === "active" && !item.isActive) return false;
      if (filters.activity === "inactive" && item.isActive) return false;
      return true;
    });
  }, [filters, items, search]);

  const sortedItems = useMemo(() => {
    if (!sort) return filteredItems;
    const multiplier = sort.direction === "asc" ? 1 : -1;
    return filteredItems.slice().sort((a, b) => {
      const av = a[sort.field];
      const bv = b[sort.field];
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * multiplier;
      }
      if (typeof av === "boolean" && typeof bv === "boolean") {
        return (Number(av) - Number(bv)) * multiplier;
      }
      return String(av).localeCompare(String(bv), undefined, { sensitivity: "base" }) * multiplier;
    });
  }, [filteredItems, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const pagedItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [page, pageSize, sortedItems, totalPages]);

  const counts = useMemo(
    () => ({
      total: items.length,
      required: items.filter((item) => item.isRequired).length,
      optional: items.filter((item) => !item.isRequired).length,
      active: items.filter((item) => item.isActive).length,
    }),
    [items]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSortToggle = (field: DocumentTypeSortField) => {
    setPage(1);
    setSort((current) => {
      if (!current || current.field !== field) {
        return { field, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { field, direction: "desc" };
      }
      return null;
    });
  };

  const openEdit = (item: DocumentTypeResponse) => {
    setEditing(item);
    setFormOpen(true);
  };

  const setFilter = <K extends keyof DocumentTypeFilters>(
    field: K,
    value: DocumentTypeFilters[K]
  ) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setSearchResetKey((current) => current + 1);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const handleColumnToggle = (id: string) => {
    if (isVisible(id) && sort?.field === id) setSort(null);
    if (isVisible(id)) {
      if (id === "name") setFilter("name", DEFAULT_FILTERS.name);
      if (id === "isRequired") setFilter("required", DEFAULT_FILTERS.required);
      if (id === "isActive") setFilter("activity", DEFAULT_FILTERS.activity);
    }
    toggleColumn(id);
  };

  const handleSaved = (saved: DocumentTypeResponse) => {
    setFormOpen(false);
    showToast(editing ? t("documentTypes.updated") : t("documentTypes.created"));
    setEditing(null);
    // Optimistic merge keeps the row in place; refreshKey ensures we still
    // pick up server-side fields like updatedAtUtc on the next render.
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx === -1) return [...prev, saved];
      const next = prev.slice();
      next[idx] = saved;
      return next;
    });
    setRefreshKey((k) => k + 1);
  };

  const actions = (
    <>
      <div className="search-box settings-module-search settings-module-search-compact">
        <SearchInput
          debounceMs={SEARCH_DEBOUNCE_MS}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Evrak türü ara"
          resetSignal={searchResetKey}
          value={search}
        />
      </div>
      {search.trim().length > 0 || JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS) ? (
        <button className="btn btn-secondary btn-sm" onClick={clearFilters} type="button">
          Filtreleri Temizle
        </button>
      ) : null}
      <label className="toolbar-toggle">
        <input
          checked={includeInactive}
          onChange={(e) => {
            setIncludeInactive(e.target.checked);
            setPage(1);
          }}
          type="checkbox"
        />
        <span>{t("documentTypes.showInactive")}</span>
      </label>
    </>
  );

  const table = (
    <>
      <table className="data-table">
        <thead>
          <tr>
            {visibleColumns.map((column) => (
              <SortableTh
                field={column.sortField}
                filterControl={buildColumnFilterControl(column.id, filters, setFilter)}
                key={column.id}
                label={column.label}
                onToggle={handleSortToggle}
                sort={sort}
              />
            ))}
            <th className="col-picker-th">
              <ColumnPicker
                columns={columns.map((column) => ({
                  id: column.id,
                  label: column.label,
                }))}
                isVisible={isVisible}
                onToggle={handleColumnToggle}
                triggerTitle="Sütunlar"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }, (_, index) => (
              <tr key={index} style={{ pointerEvents: "none" }}>
                {visibleColumns.map((column) => (
                  <td key={column.id}>
                    <span
                      className={
                        column.skeletonKind === "pill" ? "skeleton skeleton-pill" : "skeleton"
                      }
                      style={{ width: column.skeletonWidth }}
                    />
                  </td>
                ))}
                <td className="col-picker-td">
                  <span className="skeleton" style={{ width: 24 }} />
                </td>
              </tr>
            ))
          ) : pagedItems.length === 0 ? (
            <tr>
              <td className="data-table-empty" colSpan={visibleColumns.length + 1}>
                {t("documentTypes.empty")}
              </td>
            </tr>
          ) : (
            pagedItems.map((item) => (
              <tr key={item.id}>
                {visibleColumns.map((column) => (
                  <td key={column.id}>{column.renderCell(item)}</td>
                ))}
                <td className="col-picker-td">
                  <div className="table-row-actions">
                    <button
                      aria-label={t("documentTypes.edit")}
                      className="icon-btn"
                      onClick={() => openEdit(item)}
                      title={t("documentTypes.edit")}
                      type="button"
                    >
                      <PencilIcon size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <Pagination
        disabled={loading}
        onChange={setPage}
        onPageSizeChange={(nextSize) => {
          setPageSize(nextSize);
          setPage(1);
        }}
        page={Math.min(page, totalPages)}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        totalPages={totalPages}
      />
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="settings-section-stack">
          <div className="settings-summary-grid">
            <div className="settings-summary-card">
              <span className="settings-summary-label">Toplam Evrak Türü</span>
              <strong className="settings-summary-value">{counts.total}</strong>
            </div>
            <div className="settings-summary-card">
              <span className="settings-summary-label">Zorunlu</span>
              <strong className="settings-summary-value">{counts.required}</strong>
            </div>
            <div className="settings-summary-card">
              <span className="settings-summary-label">Opsiyonel</span>
              <strong className="settings-summary-value">{counts.optional}</strong>
            </div>
            <div className="settings-summary-card">
              <span className="settings-summary-label">Aktif</span>
              <strong className="settings-summary-value">{counts.active}</strong>
            </div>
          </div>

          <section className="settings-surface">
            <div className="settings-surface-header">
              <div className="settings-surface-title">{t("documentTypes.title")}</div>
              <div className="settings-module-actions">{actions}</div>
            </div>
            <div className="settings-surface-body">{table}</div>
          </section>
        </div>
      ) : (
        <>
          <PageToolbar actions={actions} title={t("documentTypes.title")} />
          <div className="table-wrap spaced">{table}</div>
        </>
      )}
      <DocumentTypeFormModal
        editing={editing}
        nextSortOrder={0}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
        open={formOpen}
      />
    </>
  );
}

type SortableThProps = {
  field: DocumentTypeSortField;
  filterControl?: ReactNode;
  label: string;
  sort: SortState;
  onToggle: (field: DocumentTypeSortField) => void;
};

function SortableTh({ field, filterControl, label, sort, onToggle }: SortableThProps) {
  const isActive = sort?.field === field;
  const direction = isActive ? sort.direction : null;
  const indicator = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
  const ariaSort: AriaAttributes["aria-sort"] = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th aria-sort={ariaSort} className={isActive ? "sortable-th active" : "sortable-th"}>
      <div className="sortable-th-shell">
        <button className="sortable-th-btn" onClick={() => onToggle(field)} type="button">
          <span>{label}</span>
          <span aria-hidden="true" className="sortable-th-indicator">
            {indicator}
          </span>
        </button>
        {filterControl ? <div className="sortable-th-filter">{filterControl}</div> : null}
      </div>
    </th>
  );
}

function buildColumnFilterControl(
  columnId: DocumentTypeColumnId,
  filters: DocumentTypeFilters,
  setFilter: <K extends keyof DocumentTypeFilters>(
    field: K,
    value: DocumentTypeFilters[K]
  ) => void
) {
  if (columnId === "name") {
    return (
      <TableHeaderTextFilter
        active={filters.name.trim().length > 0}
        onApply={(value) => setFilter("name", value)}
        onClear={() => setFilter("name", "")}
        placeholder="Ad ara"
        title="Ad filtresi"
        value={filters.name}
      />
    );
  }

  if (columnId === "isRequired") {
    return (
      <TableHeaderFilter
        active={filters.required !== DEFAULT_FILTERS.required}
        onChange={(value) => setFilter("required", value as DocumentTypeFilters["required"])}
        options={[
          { value: "all", label: "Tümü" },
          { value: "required", label: "Zorunlu" },
          { value: "optional", label: "Opsiyonel" },
        ]}
        title="Zorunluluk filtresi"
        value={filters.required}
      />
    );
  }

  if (columnId === "isActive") {
    return (
      <TableHeaderFilter
        active={filters.activity !== DEFAULT_FILTERS.activity}
        onChange={(value) => setFilter("activity", value as DocumentTypeFilters["activity"])}
        options={[
          { value: "all", label: "Tüm Durumlar" },
          { value: "active", label: "Aktif" },
          { value: "inactive", label: "Pasif" },
        ]}
        title="Durum filtresi"
        value={filters.activity}
      />
    );
  }

  return null;
}

const FILTER_MENU_VIEWPORT_GAP = 8;
const FILTER_MENU_TRIGGER_GAP = 6;
const FILTER_MENU_FALLBACK_WIDTH = 220;
const FILTER_MENU_FALLBACK_HEIGHT = 150;

type TableHeaderTextFilterProps = {
  active: boolean;
  onApply: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  title: string;
  value: string;
};

function TableHeaderTextFilter({
  active,
  onApply,
  onClear,
  placeholder,
  title,
  value,
}: TableHeaderTextFilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const measuredWidth = menuRef.current?.offsetWidth ?? FILTER_MENU_FALLBACK_WIDTH;
      const measuredHeight = menuRef.current?.offsetHeight ?? FILTER_MENU_FALLBACK_HEIGHT;
      const maxLeft = Math.max(
        FILTER_MENU_VIEWPORT_GAP,
        window.innerWidth - measuredWidth - FILTER_MENU_VIEWPORT_GAP
      );
      const left = Math.min(
        Math.max(triggerRect.right - measuredWidth, FILTER_MENU_VIEWPORT_GAP),
        maxLeft
      );
      const belowTop = triggerRect.bottom + FILTER_MENU_TRIGGER_GAP;
      const aboveTop = triggerRect.top - measuredHeight - FILTER_MENU_TRIGGER_GAP;
      const fitsBelow = belowTop + measuredHeight <= window.innerHeight - FILTER_MENU_VIEWPORT_GAP;
      const fitsAbove = aboveTop >= FILTER_MENU_VIEWPORT_GAP;
      const top = fitsBelow
        ? belowTop
        : fitsAbove
          ? aboveTop
          : Math.max(
              FILTER_MENU_VIEWPORT_GAP,
              window.innerHeight - measuredHeight - FILTER_MENU_VIEWPORT_GAP
            );

      setMenuPos({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply(draft.trim());
    setOpen(false);
  };

  return (
    <div className={open ? "table-header-filter open" : "table-header-filter"} ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={title}
        className={`table-header-filter-trigger${active ? " active" : ""}`}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        title={title}
        type="button"
      >
        <FilterIcon size={12} />
      </button>

      {open
        ? createPortal(
            <div
              className="table-header-filter-menu table-header-filter-text-menu"
              ref={menuRef}
              role="dialog"
              style={menuPos ? { top: menuPos.top, left: menuPos.left } : undefined}
            >
              <div className="table-header-filter-title">{title}</div>
              <form className="table-header-filter-form" onSubmit={submit}>
                <input
                  autoFocus
                  className="table-header-filter-input"
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={placeholder}
                  type="search"
                  value={draft}
                />
                <div className="table-header-filter-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      onClear();
                      setOpen(false);
                    }}
                    type="button"
                  >
                    Temizle
                  </button>
                  <button className="btn btn-primary btn-sm" type="submit">
                    Uygula
                  </button>
                </div>
              </form>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
