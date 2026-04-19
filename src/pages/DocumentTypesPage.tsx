import { useEffect, useMemo, useState } from "react";

import { DocumentTypeFormModal } from "../components/modals/DocumentTypeFormModal";
import { PageToolbar } from "../components/layout/PageToolbar";
import { PencilIcon, PlusIcon } from "../components/icons";
import { Panel } from "../components/ui/Panel";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { getDocumentTypes } from "../lib/documents-api";
import { useT } from "../lib/i18n";
import type { DocumentTypeResponse } from "../lib/types";

type DocumentTypeSortField = "sortOrder" | "key" | "name" | "isRequired" | "isActive";
type SortDirection = "asc" | "desc";
type SortState = { field: DocumentTypeSortField; direction: SortDirection } | null;

export function DocumentTypesPage() {
  const t = useT();
  const { showToast } = useToast();

  const [items, setItems] = useState<DocumentTypeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sort, setSort] = useState<SortState>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTypeResponse | null>(null);

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

  // Suggest a sortOrder one greater than the current max so new entries land
  // at the end of the list by default.
  const nextSortOrder = useMemo(
    () => (items.length === 0 ? 0 : Math.max(...items.map((i) => i.sortOrder)) + 1),
    [items]
  );

  const sortedItems = useMemo(() => {
    if (!sort) return items;
    const multiplier = sort.direction === "asc" ? 1 : -1;
    return items.slice().sort((a, b) => {
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
  }, [items, sort]);

  const handleSortToggle = (field: DocumentTypeSortField) => {
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

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (item: DocumentTypeResponse) => {
    setEditing(item);
    setFormOpen(true);
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

  return (
    <>
      <PageToolbar
        actions={
          <>
            <label className="toolbar-toggle">
              <input
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                type="checkbox"
              />
              <span>{t("documentTypes.showInactive")}</span>
            </label>
            <button className="btn btn-primary btn-sm" onClick={openCreate} type="button">
              <PlusIcon size={14} />
              {t("documentTypes.newButton")}
            </button>
          </>
        }
        title={t("documentTypes.title")}
      />

      <div className="table-wrap spaced">
        <Panel>
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh
                  field="sortOrder"
                  label={t("documentTypes.col.sortOrder")}
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                <SortableTh
                  field="key"
                  label={t("documentTypes.col.key")}
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                <SortableTh
                  field="name"
                  label={t("documentTypes.col.name")}
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                <SortableTh
                  field="isRequired"
                  label={t("documentTypes.col.required")}
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                <SortableTh
                  field="isActive"
                  label={t("documentTypes.col.active")}
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                <th>{t("documentTypes.col.action")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} style={{ pointerEvents: "none" }}>
                    <td>
                      <span className="skeleton" style={{ width: 24 }} />
                    </td>
                    <td>
                      <span className="skeleton" style={{ width: `${90 + (i * 17) % 60}px` }} />
                    </td>
                    <td>
                      <span className="skeleton" style={{ width: `${130 + (i * 23) % 80}px` }} />
                    </td>
                    <td>
                      <span className="skeleton" style={{ width: 32 }} />
                    </td>
                    <td>
                      <span className="skeleton skeleton-pill" style={{ width: 56 }} />
                    </td>
                    <td>
                      <span className="skeleton" style={{ width: 48 }} />
                    </td>
                  </tr>
                ))
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td className="data-table-empty" colSpan={6}>
                    {t("documentTypes.empty")}
                  </td>
                </tr>
              ) : (
                sortedItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sortOrder}</td>
                    <td>
                      <code className="doc-type-key">{item.key}</code>
                    </td>
                    <td>{item.name}</td>
                    <td>
                      {item.isRequired
                        ? t("documentTypes.required.short")
                        : t("documentTypes.notRequired.short")}
                    </td>
                    <td>
                      <StatusPill
                        label={
                          item.isActive
                            ? t("documentTypes.active")
                            : t("documentTypes.inactive")
                        }
                        status={item.isActive ? "success" : "manual"}
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(item)}
                        type="button"
                      >
                        <PencilIcon size={12} />
                        {t("documentTypes.edit")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Panel>
      </div>

      <DocumentTypeFormModal
        editing={editing}
        nextSortOrder={nextSortOrder}
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
  label: string;
  sort: SortState;
  onToggle: (field: DocumentTypeSortField) => void;
};

function SortableTh({ field, label, sort, onToggle }: SortableThProps) {
  const isActive = sort?.field === field;
  const direction = isActive ? sort.direction : null;
  const indicator = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
  const ariaSort = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th aria-sort={ariaSort} className={isActive ? "sortable-th active" : "sortable-th"}>
      <button
        className="sortable-th-btn"
        onClick={() => onToggle(field)}
        type="button"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="sortable-th-indicator">
          {indicator}
        </span>
      </button>
    </th>
  );
}
