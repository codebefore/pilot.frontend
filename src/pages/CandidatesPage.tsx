import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { CandidateDrawer } from "../components/drawers/CandidateDrawer";
import { DownloadIcon, PlusIcon } from "../components/icons";
import { PageTabs, PageToolbar } from "../components/layout/PageToolbar";
import { NewCandidateModal } from "../components/modals/NewCandidateModal";
import { CandidateDocumentBadge } from "../components/ui/CandidateDocumentBadge";
import { CandidateAvatar } from "../components/ui/CandidateAvatar";
import { ColumnPicker, type ColumnOption } from "../components/ui/ColumnPicker";
import { CustomSelect } from "../components/ui/CustomSelect";
import { Pagination } from "../components/ui/Pagination";
import { SearchInput } from "../components/ui/SearchInput";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import {
  getCandidates,
  getCandidateById,
  type CandidateSortField,
  type SortDirection,
  updateCandidate,
} from "../lib/candidates-api";
import { getDocumentChecklist } from "../lib/documents-api";
import { useT } from "../lib/i18n";
import {
  candidateMebExamResultLabel,
  candidateMebExamResultToPill,
  CANDIDATE_STATUS_OPTIONS,
  candidateStatusLabel,
  candidateStatusToPill,
  formatDateTR,
  type CandidateStatusValue,
} from "../lib/status-maps";
import type { CandidateResponse } from "../lib/types";
import { useColumnVisibility } from "../lib/use-column-visibility";

type CandidateTab = "all" | CandidateStatusValue;
type BulkActionMode = "status" | "export" | null;

const TAB_KEYS: CandidateTab[] = [
  "all",
  "pre_registered",
  "active",
  "parked",
  "graduated",
  "dropped",
];

const DEFAULT_TAB: CandidateTab = "active";

const PAGE_SIZE = 10;
const TEXT_DEBOUNCE_MS = 300;
const BULK_STATUS_OPTIONS = CANDIDATE_STATUS_OPTIONS;

type SortState = { field: CandidateSortField; direction: SortDirection } | null;

type CandidateColumnId =
  | "photo"
  | "name"
  | "nationalId"
  | "phoneNumber"
  | "email"
  | "birthDate"
  | "gender"
  | "licenseClass"
  | "group"
  | "groupStartDate"
  | "documents"
  | "missingDocuments"
  | "mebExamResult"
  | "balance"
  | "status"
  | "createdAtUtc"
  | "updatedAtUtc";

type CandidateColumnDef = {
  id: CandidateColumnId;
  /** i18n key for the header + picker label. */
  labelKey: "candidates.col.name"
    | "candidates.col.photo"
    | "candidates.col.nationalId"
    | "candidates.col.phoneNumber"
    | "candidates.col.email"
    | "candidates.col.birthDate"
    | "candidates.col.gender"
    | "candidates.col.licenseClass"
    | "candidates.col.group"
    | "candidates.col.groupStartDate"
    | "candidates.col.documents"
    | "candidates.col.missingDocuments"
    | "candidates.col.mebExamResult"
    | "candidates.col.balance"
    | "candidates.col.status"
    | "candidates.col.createdAtUtc"
    | "candidates.col.updatedAtUtc";
  /** When set, this column is sortable via the given backend field. */
  sortField?: CandidateSortField;
  headerClassName?: string;
  cellClassName?: string;
  renderCell: (c: CandidateResponse) => React.ReactNode;
  /** Approximate skeleton width in pixels (used while loading). */
  skeletonWidth: number;
};

function formatOptionalText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function formatMonthYearLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parts = iso.slice(0, 10).split("-");
  if (parts.length !== 3) return null;

  const year = parts[0];
  const monthNumber = Number(parts[1]);
  const months = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];
  const month = months[monthNumber - 1];
  if (!month) return null;
  return `${month} ${year}`;
}

function formatGroupWithTerm(candidate: CandidateResponse): string {
  if (!candidate.currentGroup) return "—";

  const title = candidate.currentGroup.title.trim();
  const monthYear = formatMonthYearLabel(candidate.currentGroup.startDate);
  if (!monthYear) return title || "—";

  for (const separator of [" - ", " — ", "-"]) {
    const suffix = `${separator}${monthYear}`;
    if (title.endsWith(suffix)) {
      const base = title.slice(0, -suffix.length).trim();
      return base.length > 0 ? `${base}-${monthYear}` : monthYear;
    }
  }

  return `${title}-${monthYear}`;
}

const CANDIDATE_COLUMNS: CandidateColumnDef[] = [
  {
    id: "photo",
    labelKey: "candidates.col.photo",
    headerClassName: "cand-photo-th",
    cellClassName: "cand-photo-td",
    renderCell: (c) => (
      <CandidateAvatar candidate={c} className="cand-avatar-cell" />
    ),
    skeletonWidth: 36,
  },
  {
    id: "name",
    labelKey: "candidates.col.name",
    sortField: "name",
    renderCell: (c) => (
      <span className="cand-name">
        {c.firstName} {c.lastName}
      </span>
    ),
    skeletonWidth: 140,
  },
  {
    id: "nationalId",
    labelKey: "candidates.col.nationalId",
    sortField: "nationalId",
    renderCell: (c) => <span className="cand-tc">{c.nationalId}</span>,
    skeletonWidth: 96,
  },
  {
    id: "phoneNumber",
    labelKey: "candidates.col.phoneNumber",
    renderCell: (c) => formatOptionalText(c.phoneNumber),
    skeletonWidth: 110,
  },
  {
    id: "email",
    labelKey: "candidates.col.email",
    renderCell: (c) => formatOptionalText(c.email),
    skeletonWidth: 180,
  },
  {
    id: "birthDate",
    labelKey: "candidates.col.birthDate",
    renderCell: (c) => formatDateTR(c.birthDate),
    skeletonWidth: 88,
  },
  {
    id: "gender",
    labelKey: "candidates.col.gender",
    renderCell: (c) => formatOptionalText(c.gender),
    skeletonWidth: 72,
  },
  {
    id: "licenseClass",
    labelKey: "candidates.col.licenseClass",
    sortField: "licenseClass",
    renderCell: (c) => c.licenseClass,
    skeletonWidth: 56,
  },
  {
    id: "group",
    labelKey: "candidates.col.group",
    sortField: "groupTitle",
    renderCell: (c) => formatGroupWithTerm(c),
    skeletonWidth: 110,
  },
  {
    id: "groupStartDate",
    labelKey: "candidates.col.groupStartDate",
    renderCell: (c) => formatDateTR(c.currentGroup?.startDate),
    skeletonWidth: 88,
  },
  {
    id: "documents",
    labelKey: "candidates.col.documents",
    sortField: "missingDocumentCount",
    renderCell: (c) => (
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
    ),
    skeletonWidth: 48,
  },
  {
    id: "missingDocuments",
    labelKey: "candidates.col.missingDocuments",
    sortField: "missingDocumentCount",
    renderCell: (c) => c.documentSummary?.missingCount ?? 0,
    skeletonWidth: 48,
  },
  {
    id: "mebExamResult",
    labelKey: "candidates.col.mebExamResult",
    renderCell: (c) =>
      c.mebExamResult ? (
        <StatusPill
          label={candidateMebExamResultLabel(c.mebExamResult)}
          status={candidateMebExamResultToPill(c.mebExamResult)}
        />
      ) : (
        "—"
      ),
    skeletonWidth: 72,
  },
  {
    id: "balance",
    labelKey: "candidates.col.balance",
    renderCell: () => "—",
    skeletonWidth: 48,
  },
  {
    id: "status",
    labelKey: "candidates.col.status",
    sortField: "status",
    renderCell: (c) => (
      <StatusPill
        label={candidateStatusLabel(c.status)}
        status={candidateStatusToPill(c.status)}
      />
    ),
    skeletonWidth: 64,
  },
  {
    id: "createdAtUtc",
    labelKey: "candidates.col.createdAtUtc",
    sortField: "createdAtUtc",
    renderCell: (c) => formatDateTR(c.createdAtUtc),
    skeletonWidth: 88,
  },
  {
    id: "updatedAtUtc",
    labelKey: "candidates.col.updatedAtUtc",
    renderCell: (c) => formatDateTR(c.updatedAtUtc),
    skeletonWidth: 88,
  },
];

const CANDIDATE_COLUMN_IDS: CandidateColumnId[] = CANDIDATE_COLUMNS.map((col) => col.id);
const DEFAULT_VISIBLE_CANDIDATE_COLUMN_IDS: CandidateColumnId[] = [
  "photo",
  "name",
  "nationalId",
  "group",
  "documents",
  "mebExamResult",
  "status",
];

export function CandidatesPage() {
  const t = useT();
  const tabs = TAB_KEYS.map((key) => ({
    key,
    label: key === "all" ? "Tum" : candidateStatusLabel(key),
  }));

  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    "candidates.columns.v7",
    CANDIDATE_COLUMN_IDS,
    DEFAULT_VISIBLE_CANDIDATE_COLUMN_IDS
  );

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<CandidateTab>(DEFAULT_TAB);
  const [sort, setSort] = useState<SortState>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkSelectEnabled, setBulkSelectEnabled] = useState(false);
  const [bulkActionMode, setBulkActionMode] = useState<BulkActionMode>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState<"" | CandidateStatusValue>("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("selected");

  const visibleColumns = CANDIDATE_COLUMNS.filter((col) => isVisible(col.id));
  const visibleBulkStatusOptions = useMemo(
    () =>
      tab === "all"
        ? BULK_STATUS_OPTIONS
        : BULK_STATUS_OPTIONS.filter((option) => option.value !== tab),
    [tab]
  );

  const pickerOptions: ColumnOption[] = CANDIDATE_COLUMNS.map((col) => ({
    id: col.id,
    label: t(col.labelKey),
  }));
  const allVisibleSelected =
    candidates.length > 0 && candidates.every((candidate) => selectedCandidateIds.has(candidate.id));
  const selectedCount = selectedCandidateIds.size;

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
        status: tab === "all" ? undefined : tab,
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

  useEffect(() => {
    if (
      bulkStatusValue &&
      !visibleBulkStatusOptions.some((option) => option.value === bulkStatusValue)
    ) {
      setBulkStatusValue("");
    }
  }, [bulkStatusValue, visibleBulkStatusOptions]);

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

  const exportCandidatesToCsv = (rowsToExport: CandidateResponse[]) => {
    const rows = rowsToExport.map((candidate) => ({
      "Ad Soyad": `${candidate.firstName} ${candidate.lastName}`.trim(),
      "TC Kimlik": candidate.nationalId,
      Telefon: formatOptionalText(candidate.phoneNumber),
      "E-posta": formatOptionalText(candidate.email),
      "Doğum Tarihi": formatDateTR(candidate.birthDate),
      Cinsiyet: formatOptionalText(candidate.gender),
      "Ehliyet Tipi": candidate.licenseClass,
      Grup: formatGroupWithTerm(candidate),
      "Tamamlanan Evrak": candidate.documentSummary?.completedCount ?? 0,
      "Eksik Evrak": candidate.documentSummary?.missingCount ?? 0,
      "MEB Sonucu": candidate.mebExamResult
        ? candidateMebExamResultLabel(candidate.mebExamResult)
        : "—",
      Durum: candidateStatusLabel(candidate.status),
      "Kayıt Tarihi": formatDateTR(candidate.createdAtUtc),
    }));

    const headers = [
      "Ad Soyad",
      "TC Kimlik",
      "Telefon",
      "E-posta",
      "Doğum Tarihi",
      "Cinsiyet",
      "Ehliyet Tipi",
      "Grup",
      "Tamamlanan Evrak",
      "Eksik Evrak",
      "MEB Sonucu",
      "Durum",
      "Kayıt Tarihi",
    ] as const;

    const escapeCsvValue = (value: string | number) => {
      const text = String(value);
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replaceAll("\"", "\"\"")}"`;
      }
      return text;
    };

    const csvLines = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
    ];

    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `adaylar-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const downloadSelectedCandidatesCsv = async () => {
    if (selectedCandidateIds.size === 0) {
      return;
    }

    setBulkExporting(true);

    try {
      const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const selectedIds = Array.from(selectedCandidateIds);
      const selectedCandidates = await Promise.all(
        selectedIds.map(
          async (candidateId) => candidateById.get(candidateId) ?? (await getCandidateById(candidateId))
        )
      );

      exportCandidatesToCsv(selectedCandidates);
      setBulkActionMode(null);
    } catch {
      showToast("Seçili adaylar dışa aktarılamadı", "error");
    } finally {
      setBulkExporting(false);
    }
  };

  const toggleBulkSelection = () => {
    setBulkSelectEnabled((current) => {
      const next = !current;
      if (!next) {
        setBulkActionMode(null);
        setSelectedCandidateIds(new Set());
        setBulkStatusValue("");
      }
      return next;
    });
  };

  const toggleCandidateSelection = (candidateId: string) => {
    setSelectedCandidateIds((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  };

  const toggleVisibleCandidateSelection = () => {
    setSelectedCandidateIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const candidate of candidates) {
          next.delete(candidate.id);
        }
      } else {
        for (const candidate of candidates) {
          next.add(candidate.id);
        }
      }
      return next;
    });
  };

  const openBulkStatusAction = () => {
    if (selectedCandidateIds.size === 0) {
      showToast("Önce en az bir aday seç", "error");
      return;
    }
    setBulkActionMode("status");
  };

  const openBulkExportAction = () => {
    if (selectedCandidateIds.size === 0) {
      showToast("Önce en az bir aday seç", "error");
      return;
    }
    setBulkActionMode("export");
  };

  const buildCandidateUpdatePayload = (
    candidate: CandidateResponse,
    status: CandidateStatusValue
  ) => ({
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    nationalId: candidate.nationalId,
    phoneNumber: candidate.phoneNumber,
    email: candidate.email,
    birthDate: candidate.birthDate,
    gender: candidate.gender,
    licenseClass: candidate.licenseClass,
    existingLicenseType: candidate.existingLicenseType,
    existingLicenseIssuedAt: candidate.existingLicenseIssuedAt,
    existingLicenseNumber: candidate.existingLicenseNumber,
    existingLicenseIssuedProvince: candidate.existingLicenseIssuedProvince,
    existingLicensePre2016: candidate.existingLicensePre2016,
    status,
  });

  const applyBulkStatusChange = async () => {
    if (!bulkStatusValue || selectedCandidateIds.size === 0) {
      return;
    }

    setBulkSaving(true);

    try {
      const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const selectedIds = Array.from(selectedCandidateIds);

      await Promise.all(
        selectedIds.map(async (candidateId) => {
          const candidate = candidateById.get(candidateId) ?? (await getCandidateById(candidateId));
          await updateCandidate(candidateId, buildCandidateUpdatePayload(candidate, bulkStatusValue));
        })
      );

      showToast(`${selectedIds.length} aday güncellendi`);
      setBulkActionMode(null);
      setSelectedCandidateIds(new Set());
      setBulkStatusValue("");
      setRefreshKey((k) => k + 1);
    } catch {
      showToast("Toplu durum güncellenemedi", "error");
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <>
      <PageToolbar
        actions={
          bulkSelectEnabled ? (
            <div className="candidate-bulk-toolbar">
              <span className="candidate-bulk-count">{selectedCount} seçili</span>
              {bulkActionMode === "status" ? (
                <>
                  <CustomSelect
                    aria-label="Toplu durum seç"
                    onChange={(event) =>
                      setBulkStatusValue(event.target.value as "" | CandidateStatusValue)
                    }
                    size="sm"
                    value={bulkStatusValue}
                  >
                    <option value="">Durum seç</option>
                    {visibleBulkStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </CustomSelect>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={selectedCount === 0 || !bulkStatusValue || bulkSaving}
                    onClick={applyBulkStatusChange}
                    type="button"
                  >
                    {bulkSaving ? "Güncelleniyor..." : "Uygula"}
                  </button>
                </>
              ) : bulkActionMode === "export" ? (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={selectedCount === 0 || bulkExporting}
                  onClick={downloadSelectedCandidatesCsv}
                  type="button"
                >
                  {bulkExporting ? "İndiriliyor..." : "CSV İndir"}
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={openBulkStatusAction}
                    type="button"
                  >
                    Durum Değiştir
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={openBulkExportAction}
                    type="button"
                  >
                    <DownloadIcon size={14} />
                    Dışa Aktar
                  </button>
                </>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={toggleBulkSelection}
                type="button"
              >
                Kapat
              </button>
            </div>
          ) : (
            <>
              <button
                aria-pressed={bulkSelectEnabled}
                className="btn btn-secondary btn-sm"
                onClick={toggleBulkSelection}
                type="button"
              >
                Toplu Seçim
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
          )
        }
        title="Adaylar"
      />

      <div className="tabs-search-row">
        <PageTabs active={tab} onChange={handleTabChange} tabs={tabs} />
        <div className="search-box">
          <SearchInput
            onChange={handleSearchChange}
            placeholder="Aday ara... (ad, soyad, TC)"
            value={search}
          />
        </div>
      </div>

      <div className="table-wrap spaced">
        <table className="data-table cand-table">
          <thead>
            <tr>
              {bulkSelectEnabled && (
                <th className="cand-select-th">
                  <span className="cand-select-control">
                    <input
                      aria-label="Bu sayfadaki tüm adayları seç"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleCandidateSelection}
                      type="checkbox"
                    />
                  </span>
                </th>
              )}
              {visibleColumns.map((col) =>
                col.sortField ? (
                  <SortableTh
                    className={col.headerClassName}
                    key={col.id}
                    field={col.sortField}
                    label={t(col.labelKey)}
                    onToggle={handleSortToggle}
                    sort={sort}
                  />
                ) : (
                  <th className={col.headerClassName} key={col.id}>
                    {t(col.labelKey)}
                  </th>
                )
              )}
              <th className="col-picker-th">
                <ColumnPicker
                  columns={pickerOptions}
                  isVisible={isVisible}
                  onToggle={toggleColumn}
                  triggerTitle={t("candidates.columns.button")}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                {Array.from({ length: PAGE_SIZE }, (_, i) => (
                  <tr key={i} style={{ pointerEvents: "none" }}>
                    {bulkSelectEnabled && <td className="cand-select-td" />}
                    {visibleColumns.map((col) => (
                      <td className={col.cellClassName} key={col.id}>
                        <span
                          className="skeleton"
                          style={{ width: `${col.skeletonWidth + (i * 11) % 24}px` }}
                        />
                      </td>
                    ))}
                    <td className="col-picker-td" />
                  </tr>
                ))}
              </>
            ) : candidates.length === 0 ? (
              <tr>
                <td
                  className="data-table-empty"
                  colSpan={visibleColumns.length + 1 + (bulkSelectEnabled ? 1 : 0)}
                >
                  Eşleşen aday bulunamadı.
                </td>
              </tr>
            ) : (
              candidates.map((c) => (
                <tr key={c.id} onClick={() => openDrawer(c.id)}>
                  {bulkSelectEnabled && (
                    <td
                      className="cand-select-td"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span className="cand-select-control">
                        <input
                          aria-label={`${c.firstName} ${c.lastName} seç`}
                          checked={selectedCandidateIds.has(c.id)}
                          onChange={() => toggleCandidateSelection(c.id)}
                          onClick={(event) => event.stopPropagation()}
                          type="checkbox"
                        />
                      </span>
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td className={col.cellClassName} key={col.id}>
                      {col.renderCell(c)}
                    </td>
                  ))}
                  <td className="col-picker-td" />
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
  label: string;
  sort: SortState;
  onToggle: (field: CandidateSortField) => void;
  className?: string;
};

function SortableTh({ field, label, sort, onToggle, className }: SortableThProps) {
  const isActive = sort?.field === field;
  const direction = isActive ? sort!.direction : null;
  const indicator = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
  const ariaSort: React.AriaAttributes["aria-sort"] = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";
  const thClassName = [isActive ? "sortable-th active" : "sortable-th", className]
    .filter(Boolean)
    .join(" ");
  return (
    <th aria-sort={ariaSort} className={thClassName}>
      <button
        className="sortable-th-btn"
        onClick={() => onToggle(field)}
        type="button"
      >
        <span>{label}</span>
        <span className="sortable-th-indicator" aria-hidden="true">
          {indicator}
        </span>
      </button>
    </th>
  );
}
