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
import { useT } from "../lib/i18n";
import { getCandidates } from "../lib/candidates-api";
import { getDocumentChecklist } from "../lib/documents-api";
import { candidateStatusLabel, candidateStatusToPill } from "../lib/status-maps";
import type { CandidateResponse } from "../lib/types";

type CandidateTab = "all" | "active" | "completed";

const TAB_KEYS: CandidateTab[] = ["all", "active", "completed"];

const TAB_STATUS: Record<CandidateTab, string | undefined> = {
  all:       undefined,
  active:    "active",
  completed: "completed",
};

const PAGE_SIZE = 10;

export function CandidatesPage() {
  const t = useT();
  const tabs = TAB_KEYS.map((key) => ({ key, label: t(`candidates.tab.${key}` as const) }));

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<CandidateTab>("all");
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
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);

      getCandidates(
        {
          search: search.trim() || undefined,
          status: TAB_STATUS[tab],
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
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, tab, page, refreshKey, showToast]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTabChange = (value: CandidateTab) => {
    setTab(value);
    setPage(1);
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
              <th>Ad Soyad</th>
              <th>TC Kimlik</th>
              <th>Grup</th>
              <th>Evrak</th>
              <th>Bakiye</th>
              <th>MEB Durumu</th>
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
