import { useEffect, useRef, useState } from "react";

import { CheckIcon, PlusIcon, XIcon } from "../components/icons";
import { PageToolbar } from "../components/layout/PageToolbar";
import { UploadDocumentModal } from "../components/modals/UploadDocumentModal";
import { CandidateAvatar } from "../components/ui/CandidateAvatar";
import { Pagination } from "../components/ui/Pagination";
import { Panel } from "../components/ui/Panel";
import { SearchInput } from "../components/ui/SearchInput";
import { useToast } from "../components/ui/Toast";
import { getDocumentChecklist, getDocumentTypes } from "../lib/documents-api";
import { useT } from "../lib/i18n";
import { buildWhatsAppUrl, formatPhoneNumber } from "../lib/phone";
import { normalizeTextQuery } from "../lib/search";
import type { DocumentChecklistEntry, DocumentTypeResponse } from "../lib/types";

type Filters = {
  search: string;
};

const INITIAL_FILTERS: Filters = {
  search: "",
};

const PAGE_SIZE = 20;
const TEXT_DEBOUNCE_MS = 300;

type DocumentSortField = "name";
type SortDirection = "asc" | "desc";
type SortState = { field: DocumentSortField; direction: SortDirection } | null;

type UploadTarget = {
  candidateId?: string;
  candidateName?: string;
  documentTypeId?: string;
} | null;

function shortDocumentTypeLabel(name: string): string {
  const trimmed = name.trim();
  const visible = trimmed.slice(0, 8);
  return trimmed.length > 8 ? `${visible}..` : trimmed;
}

function documentSummaryToneClass(
  summary: DocumentChecklistEntry["summary"]
): "documents-summary-empty" | "documents-summary-partial" | "documents-summary-complete" {
  if (summary.totalRequiredCount === 0 || summary.completedCount >= summary.totalRequiredCount) {
    return "documents-summary-complete";
  }

  if (summary.completedCount === 0) {
    return "documents-summary-empty";
  }

  return "documents-summary-partial";
}

function toAvatarCandidate(entry: DocumentChecklistEntry) {
  const trimmed = entry.fullName.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? trimmed;
  const lastName = parts.slice(1).join(" ") || parts[0] || trimmed;

  return {
    id: entry.candidateId,
    firstName,
    lastName,
    photo: entry.photo ?? null,
  };
}

function renderPhoneNumber(entry: DocumentChecklistEntry) {
  const phoneNumber = formatPhoneNumber(entry.phoneNumber);
  const whatsappUrl = buildWhatsAppUrl(entry.phoneNumber);

  if (!whatsappUrl) {
    return <div className="cand-secondary-text">{phoneNumber}</div>;
  }

  return (
    <a
      className="documents-phone-link"
      href={whatsappUrl}
      onClick={(event) => event.stopPropagation()}
      rel="noreferrer"
      target="_blank"
    >
      {phoneNumber}
    </a>
  );
}

export function DocumentsPage() {
  const t = useT();
  const { showToast } = useToast();

  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortState>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [entries, setEntries] = useState<DocumentChecklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const lastFetchKeyRef = useRef<string | null>(null);

  const [documentTypes, setDocumentTypes] = useState<DocumentTypeResponse[]>([]);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget>(null);

  useEffect(() => {
    const controller = new AbortController();
    getDocumentTypes(undefined, controller.signal)
      .then(setDocumentTypes)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast(t("uploadDoc.errors.typesLoadFailed"), "error");
      });
    return () => controller.abort();
  }, [showToast, t]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(filters.search),
      TEXT_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    const controller = new AbortController();
    const requestParams = {
      search: normalizeTextQuery(debouncedSearch),
      page,
      pageSize: PAGE_SIZE,
    };
    const fetchKey = JSON.stringify({ ...requestParams, refreshKey });
    if (lastFetchKeyRef.current === fetchKey) {
      return () => controller.abort();
    }

    lastFetchKeyRef.current = fetchKey;
    setLoading(true);

    getDocumentChecklist(requestParams, controller.signal)
      .then((result) => {
        setEntries(result.items);
        setTotalPages(result.totalPages);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast(t("documents.loadFailed"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, page, refreshKey, showToast, t]);

  const patchFilters = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  const handleSortToggle = (field: DocumentSortField) => {
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

  const hasAnyFilter = !!filters.search;

  const openUpload = (entry?: DocumentChecklistEntry, documentTypeId?: string) => {
    const firstMissingType = documentTypeId ?? (
      entry?.missingDocumentKeys[0]
        ? documentTypes.find((item) => item.key === entry.missingDocumentKeys[0])?.id
        : undefined
    );

    setUploadTarget({
      candidateId: entry?.candidateId,
      candidateName: entry?.fullName,
      documentTypeId: firstMissingType,
    });
  };

  const handleUploaded = () => {
    setUploadTarget(null);
    showToast(t("documents.uploaded"));
    setRefreshKey((current) => current + 1);
  };

  const emptyMessage = hasAnyFilter
    ? t("documents.empty.filtered")
    : t("documents.empty.all");
  const requiredDocumentTypes = [...documentTypes]
    .filter((documentType) => documentType.isRequired && documentType.isActive)
    .sort((left, right) =>
      left.sortOrder === right.sortOrder
        ? left.name.localeCompare(right.name, "tr", { sensitivity: "base" })
        : left.sortOrder - right.sortOrder
    );
  const sortedEntries = [...entries].sort((left, right) => {
    if (!sort || sort.field !== "name") {
      return 0;
    }

    const byLastName = left.fullName.localeCompare(right.fullName, "tr", { sensitivity: "base" });
    return sort.direction === "asc" ? byLastName : -byLastName;
  });

  return (
    <>
      <PageToolbar
        actions={
          <div className="documents-toolbar-actions">
            <button className="btn btn-primary btn-sm" onClick={() => openUpload()} type="button">
              <PlusIcon size={12} />
              {t("documents.action.upload")}
            </button>
            <div className="search-box documents-toolbar-search">
              <SearchInput
                onChange={(value) => patchFilters({ search: value })}
                placeholder={t("documents.searchPlaceholder")}
                value={filters.search}
              />
              {hasAnyFilter && (
                <button
                  className="btn btn-secondary btn-sm filter-clear"
                  onClick={handleClearFilters}
                  type="button"
                >
                  <XIcon size={12} />
                  {t("common.clearFilters")}
                </button>
              )}
            </div>
          </div>
        }
        title={t("documents.title")}
      />

      <div className="table-wrap spaced documents-table-wrap">
        <Panel>
          <table className="data-table documents-table">
            <thead>
              <tr>
                <th aria-label="Resim" className="cand-photo-th" />
                <SortableTh
                  field="name"
                  label={t("documents.col.candidate")}
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                {requiredDocumentTypes.map((documentType) => (
                  <th
                    className="documents-doc-th"
                    key={documentType.id}
                    title={documentType.name}
                  >
                    <span aria-label={documentType.name} className="documents-doc-label">
                      {shortDocumentTypeLabel(documentType.name)}
                    </span>
                  </th>
                ))}
                <th>{t("documents.col.summary")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, index) => (
                  <tr key={index} style={{ pointerEvents: "none" }}>
                    <td className="cand-photo-td">
                      <span className="skeleton" style={{ width: 28, height: 28, borderRadius: "999px" }} />
                    </td>
                    <td>
                      <span className="skeleton" style={{ width: `${110 + (index * 37) % 60}px` }} />
                    </td>
                    {requiredDocumentTypes.map((documentType, docIndex) => (
                      <td className="documents-doc-td" key={documentType.id}>
                        <span
                          className="skeleton"
                          style={{ width: `${18 + ((index + docIndex) * 5) % 6}px` }}
                        />
                      </td>
                    ))}
                    <td>
                      <span className="skeleton" style={{ width: 88 }} />
                    </td>
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td className="data-table-empty" colSpan={requiredDocumentTypes.length + 3}>
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry) => {
                  return (
                    <tr key={entry.candidateId}>
                      <td className="cand-photo-td">
                        <CandidateAvatar
                          candidate={toAvatarCandidate(entry)}
                          className="cand-avatar-cell"
                          size={30}
                        />
                      </td>
                      <td>
                        <div className="cand-name">{entry.fullName}</div>
                        {renderPhoneNumber(entry)}
                      </td>
                      {requiredDocumentTypes.map((documentType) => {
                        const hasDocument = !entry.missingDocumentKeys.includes(documentType.key);
                        const documentTypeId = documentType.id;
                        return (
                          <td className="documents-doc-td" key={documentType.id}>
                            {hasDocument ? (
                              <span
                                aria-label={`${documentType.name}: var`}
                                className="documents-doc-icon present"
                                title={`${documentType.name}: Var`}
                              >
                                <CheckIcon size={16} />
                              </span>
                            ) : (
                              <button
                                aria-label={`${documentType.name}: yok, yukle`}
                                className="documents-doc-icon-btn"
                                onClick={() => openUpload(entry, documentTypeId)}
                                title={`${documentType.name}: Yok - Yükle`}
                                type="button"
                              >
                                <span className="documents-doc-icon missing">
                                  <XIcon size={16} />
                                </span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td>
                        <span className={documentSummaryToneClass(entry.summary)}>
                          {t("documents.summary", {
                            completedCount: entry.summary.completedCount,
                            totalRequiredCount: entry.summary.totalRequiredCount,
                            missingCount: entry.summary.missingCount,
                          })}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Panel>
      </div>

      <Pagination onChange={setPage} page={page} totalPages={totalPages} />

      <UploadDocumentModal
        candidateId={uploadTarget?.candidateId ?? null}
        candidateName={uploadTarget?.candidateName}
        documentTypes={documentTypes}
        initialDocumentTypeId={uploadTarget?.documentTypeId}
        onClose={() => setUploadTarget(null)}
        onUploaded={handleUploaded}
        open={uploadTarget !== null}
      />
    </>
  );
}

type SortableThProps = {
  field: DocumentSortField;
  label: string;
  sort: SortState;
  onToggle: (field: DocumentSortField) => void;
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
