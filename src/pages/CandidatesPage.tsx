import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { CandidateDrawer } from "../components/drawers/CandidateDrawer";
import { DownloadIcon, PlusIcon } from "../components/icons";
import { PageTabs, PageToolbar } from "../components/layout/PageToolbar";
import { NewCandidateModal } from "../components/modals/NewCandidateModal";
import { CandidateDocumentBadge } from "../components/ui/CandidateDocumentBadge";
import { Pagination } from "../components/ui/Pagination";
import { SearchInput } from "../components/ui/SearchInput";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import {
  getCandidates,
  type CandidateSortField,
  type SortDirection,
} from "../lib/candidates-api";
import { getDocumentChecklist } from "../lib/documents-api";
import {
  candidateStatusLabel,
  candidateStatusToPill,
  type CandidateStatusValue,
} from "../lib/status-maps";
import type { CandidateResponse } from "../lib/types";

type CandidateTab = CandidateStatusValue;

const TAB_KEYS: CandidateTab[] = [
  "pre_registered",
  "active",
  "parked",
  "graduated",
  "dropped",
];

const DEFAULT_TAB: CandidateTab = "active";

const PAGE_SIZE = 10;
const TEXT_DEBOUNCE_MS = 300;

type SortState = { field: CandidateSortField; direction: SortDirection } | null;

type SortableColumn = {
  field: CandidateSortField;
  label: string;
};

const SORTABLE_COLUMNS: Record<CandidateSortField, SortableColumn> = {
  name:                  { field: "name",                  label: "Ad Soyad" },
  nationalId:            { field: "nationalId",            label: "TC Kimlik" },
  groupTitle:            { field: "groupTitle",            label: "Grup" },
  missingDocumentCount:  { field: "missingDocumentCount",  label: "Evrak" },
  status:                { field: "status",                label: "Durum" },
  createdAtUtc:          { field: "createdAtUtc",          label: "Kayıt Tarihi" },
  licenseClass:          { field: "licenseClass",          label: "Sınıf" },
};

export function CandidatesPage() {
  const tabs = TAB_KEYS.map((key) => ({ key, label: candidateStatusLabel(key) }));

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<CandidateTab>(DEFAULT_TAB);
  const [sort, setSort] = useState<SortState>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("selected");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, TEXT_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    getCandidates(
      {
        search: debouncedSearch.trim() || undefined,
        status: tab,
        sortBy: sort?.field,
        sortDir: sort?.direction,
        page,
        pageSize: PAGE_SIZE,
      },
      controller.signal
    )
      .then((result) => {
        setCandidates(result.items);
        setTotalPages(result.totalPages);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast("Adaylar yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [debouncedSearch, page, refreshKey, showToast, sort, tab]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTabChange = (value: CandidateTab) => {
    setTab(value);
    setPage(1);
  };

  /**
   * Cycle the sort state for a clicked header:
   *   unsorted -> asc -> desc -> unsorted
   * Always resets pagination to page 1 so the first row of the newly sorted
   * result set is visible.
   */
  const handleSortToggle = (field: CandidateSortField) => {
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

  const openDrawer = (id: string) => setSearchParams({ selected: id });
  const closeDrawer = () => setSearchParams({});

  const handleSubmitNew = () => {
    setModalOpen(false);
    setPage(1);
    setRefreshKey((k) => k + 1);
  };

  return (
    <>
      <PageToolbar
        actions={
          <>
            <button className="btn btn-secondary btn-sm" type="button">
              <DownloadIcon size={14} />
              Dışa Aktar
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setModalOpen(true)}
              type="button"
            >
              <PlusIcon size={14} />
              Yeni Aday
            </button>
          </>
        }
        title="Adaylar"
      />

      <PageTabs active={tab} onChange={handleTabChange} tabs={tabs} />

      <div className="search-box">
        <SearchInput
          onChange={handleSearchChange}
          placeholder="Aday ara... (ad, soyad, TC)"
          value={search}
        />
      </div>

      <div className="table-wrap">
        <table className="data-table cand-table">
          <thead>
            <tr>
              <SortableTh
                field="name"
                onToggle={handleSortToggle}
                sort={sort}
              />
              <SortableTh
                field="nationalId"
                onToggle={handleSortToggle}
                sort={sort}
              />
              <SortableTh
                field="groupTitle"
                onToggle={handleSortToggle}
                sort={sort}
              />
              <SortableTh
                field="missingDocumentCount"
                onToggle={handleSortToggle}
                sort={sort}
              />
              <th>Bakiye</th>
              <SortableTh
                field="status"
                onToggle={handleSortToggle}
                sort={sort}
              />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                {Array.from({ length: PAGE_SIZE }, (_, i) => (
                  <tr key={i} style={{ pointerEvents: "none" }}>
                    <td><span className="skeleton" style={{ width: `${110 + (i * 37) % 60}px` }} /></td>
                    <td><span className="skeleton" style={{ width: "96px" }} /></td>
                    <td><span className="skeleton" style={{ width: `${80 + (i * 23) % 50}px` }} /></td>
                    <td><span className="skeleton" style={{ width: "32px" }} /></td>
                    <td><span className="skeleton" style={{ width: "48px" }} /></td>
                    <td><span className="skeleton skeleton-pill" style={{ width: "64px" }} /></td>
                  </tr>
                ))}
              </>
            ) : candidates.length === 0 ? (
              <tr>
                <td className="data-table-empty" colSpan={6}>
                  Eşleşen aday bulunamadı.
                </td>
              </tr>
            ) : (
              candidates.map((c) => (
                <tr key={c.id} onClick={() => openDrawer(c.id)}>
                  <td>
                    <span className="cand-name">
                      {c.firstName} {c.lastName}
                    </span>
                  </td>
                  <td>
                    <span className="cand-tc">{c.nationalId}</span>
                  </td>
                  <td>{c.currentGroup?.title ?? "—"}</td>
                  <td>
                    <CandidateDocumentBadge
                      loadMissingDocumentNames={async () => {
                        const result = await getDocumentChecklist({
                          status: "missing",
                          search: c.nationalId,
                          page: 1,
                          pageSize: 1,
                        });
                        return result.items[0]?.missingDocumentNames ?? [];
                      }}
                      summary={c.documentSummary}
                    />
                  </td>
                  <td>—</td>
                  <td>
                    <StatusPill
                      label={candidateStatusLabel(c.status)}
                      status={candidateStatusToPill(c.status)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination disabled={loading} onChange={setPage} page={page} totalPages={totalPages} />

      <CandidateDrawer
        candidateId={selectedId}
        onClose={closeDrawer}
        onDeleted={() => {
          closeDrawer();
          setRefreshKey((k) => k + 1);
        }}
        onUpdated={() => setRefreshKey((k) => k + 1)}
        onStartMebJob={() => {
          showToast("MEB işi oluşturuldu");
          closeDrawer();
        }}
        onTakePayment={() => {
          showToast("Tahsilat ekranı açıldı");
          closeDrawer();
        }}
      />

      <NewCandidateModal
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmitNew}
        open={modalOpen}
      />
    </>
  );
}

type SortableThProps = {
  field: CandidateSortField;
  sort: SortState;
  onToggle: (field: CandidateSortField) => void;
};

function SortableTh({ field, sort, onToggle }: SortableThProps) {
  const column = SORTABLE_COLUMNS[field];
  const isActive = sort?.field === field;
  const direction = isActive ? sort!.direction : null;
  const indicator = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
  const ariaSort: React.AriaAttributes["aria-sort"] = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";
  const className = isActive ? "sortable-th active" : "sortable-th";
  return (
    <th aria-sort={ariaSort} className={className}>
      <button
        className="sortable-th-btn"
        onClick={() => onToggle(field)}
        type="button"
      >
        <span>{column.label}</span>
        <span className="sortable-th-indicator" aria-hidden="true">
          {indicator}
        </span>
      </button>
    </th>
  );
}
