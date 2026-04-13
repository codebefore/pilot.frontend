import { useEffect, useMemo, useState } from "react";

import { PlusIcon, XIcon } from "../components/icons";
import { PageTabs, PageToolbar } from "../components/layout/PageToolbar";
import { UploadDocumentModal } from "../components/modals/UploadDocumentModal";
import { Pagination } from "../components/ui/Pagination";
import { Panel } from "../components/ui/Panel";
import { SearchInput } from "../components/ui/SearchInput";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import {
  getDocumentChecklist,
  getDocumentTypes,
  type DocumentChecklistTab,
} from "../lib/documents-api";
import { useT } from "../lib/i18n";
import { documentStatusToPill } from "../lib/status-maps";
import type { DocumentChecklistEntry, DocumentStatus, DocumentTypeResponse } from "../lib/types";

type Filters = {
  search: string;
  documentTypeId: string;
};

const INITIAL_FILTERS: Filters = {
  search: "",
  documentTypeId: "",
};

const TAB_KEYS: DocumentChecklistTab[] = ["missing", "all"];
const PAGE_SIZE = 20;
const TEXT_DEBOUNCE_MS = 300;

type UploadTarget = {
  candidateId?: string;
  candidateName?: string;
  documentTypeId?: string;
} | null;

export function DocumentsPage() {
  const t = useT();
  const { showToast } = useToast();

  const [tab, setTab] = useState<DocumentChecklistTab>("missing");
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [entries, setEntries] = useState<DocumentChecklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [documentTypes, setDocumentTypes] = useState<DocumentTypeResponse[]>([]);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget>(null);

  const tabs = useMemo(
    () =>
      TAB_KEYS.map((key) => ({
        key,
        label: key === "missing" ? t("documents.tab.missing") : t("documents.tab.all"),
      })),
    [t]
  );

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
    setLoading(true);

    const status: DocumentStatus | undefined = tab === "missing" ? "missing" : undefined;

    getDocumentChecklist(
      {
        search: debouncedSearch.trim() || undefined,
        documentTypeId: filters.documentTypeId || undefined,
        status,
        page,
        pageSize: PAGE_SIZE,
      },
      controller.signal
    )
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
  }, [tab, debouncedSearch, filters.documentTypeId, page, refreshKey, showToast, t]);

  const patchFilters = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  const hasAnyFilter = !!(filters.search || filters.documentTypeId);

  const openUpload = (entry?: DocumentChecklistEntry) => {
    const firstMissingType = entry?.missingDocumentKeys[0]
      ? documentTypes.find((item) => item.key === entry.missingDocumentKeys[0])?.id
      : undefined;

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
    : tab === "missing"
    ? t("documents.empty.missing")
    : t("documents.empty.all");

  return (
    <>
      <PageToolbar
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => openUpload()} type="button">
            <PlusIcon size={12} />
            {t("documents.action.upload")}
          </button>
        }
        title={t("documents.title")}
      />

      <PageTabs active={tab} onChange={(next) => { setTab(next); setPage(1); }} tabs={tabs} />

      <div className="search-box">
        <SearchInput
          onChange={(value) => patchFilters({ search: value })}
          placeholder={t("documents.searchPlaceholder")}
          value={filters.search}
        />
        <select
          aria-label={t("documents.filter.documentType")}
          className="form-select filter-select"
          onChange={(e) => patchFilters({ documentTypeId: e.target.value })}
          value={filters.documentTypeId}
        >
          <option value="">{t("documents.filter.allTypes")}</option>
          {documentTypes.map((documentType) => (
            <option key={documentType.id} value={documentType.id}>
              {documentType.name}
            </option>
          ))}
        </select>
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

      <div className="table-wrap spaced">
        <Panel>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("documents.col.candidate")}</th>
                <th>{t("documents.col.missingDocuments")}</th>
                <th>{t("documents.col.status")}</th>
                <th>{t("documents.col.summary")}</th>
                <th>{t("documents.col.action")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, index) => (
                  <tr key={index} style={{ pointerEvents: "none" }}>
                    <td>
                      <span className="skeleton" style={{ width: `${110 + (index * 37) % 60}px` }} />
                    </td>
                    <td>
                      <span className="skeleton" style={{ width: `${120 + (index * 19) % 70}px` }} />
                    </td>
                    <td>
                      <span className="skeleton skeleton-pill" style={{ width: 70 }} />
                    </td>
                    <td>
                      <span className="skeleton" style={{ width: 88 }} />
                    </td>
                    <td>
                      <span className="skeleton" style={{ width: 56 }} />
                    </td>
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td className="data-table-empty" colSpan={5}>
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const status: DocumentStatus =
                    entry.summary.missingCount > 0 ? "missing" : "uploaded";

                  return (
                    <tr key={entry.candidateId}>
                      <td>
                        <div className="cand-name">{entry.fullName}</div>
                        <div className="cand-tc">{entry.nationalId}</div>
                      </td>
                      <td>
                        {entry.missingDocumentNames.length > 0
                          ? entry.missingDocumentNames.join(", ")
                          : null}
                      </td>
                      <td>
                        <StatusPill
                          label={t(`documentStatus.${status}` as const)}
                          status={documentStatusToPill(status)}
                        />
                      </td>
                      <td>
                        {t("documents.summary", {
                          completedCount: entry.summary.completedCount,
                          totalRequiredCount: entry.summary.totalRequiredCount,
                          missingCount: entry.summary.missingCount,
                        })}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openUpload(entry)}
                          type="button"
                        >
                          <PlusIcon size={12} />
                          {t("documents.action.upload")}
                        </button>
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
