import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { CandidateDrawer } from "../components/drawers/CandidateDrawer";
import { DownloadIcon, FilterIcon, PlusIcon } from "../components/icons";
import { PageTabs, PageToolbar } from "../components/layout/PageToolbar";
import { NewCandidateModal } from "../components/modals/NewCandidateModal";
import { DocProgress } from "../components/ui/DocProgress";
import { FilterChip } from "../components/ui/FilterChip";
import { SearchInput } from "../components/ui/SearchInput";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import {
  formatBalance,
  mockCandidates,
  type Candidate,
  type CandidateClass,
} from "../mock/candidates";

type ClassFilter = "all" | CandidateClass;
type CandidateTab = "all" | "active" | "completed";

const CLASS_FILTERS: { key: ClassFilter; label: string }[] = [
  { key: "all", label: "Tüm Sınıflar" },
  { key: "B",   label: "B Sınıfı" },
  { key: "A2",  label: "A2 Sınıfı" },
  { key: "C",   label: "C Sınıfı" },
];

const TABS: { key: CandidateTab; label: string }[] = [
  { key: "all",       label: "Tüm Adaylar" },
  { key: "active",    label: "Aktif Dönem" },
  { key: "completed", label: "Tamamlanan" },
];

function filterCandidates(
  list: Candidate[],
  search: string,
  classFilter: ClassFilter
): Candidate[] {
  const q = search.trim().toLocaleLowerCase("tr-TR");
  return list.filter((c) => {
    if (classFilter !== "all" && c.className !== classFilter) return false;
    if (!q) return true;
    return (
      c.fullName.toLocaleLowerCase("tr-TR").includes(q) ||
      c.tc.includes(q)
    );
  });
}

export function CandidatesPage() {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  const [tab, setTab] = useState<CandidateTab>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("selected");

  const filtered = useMemo(
    () => filterCandidates(mockCandidates, search, classFilter),
    [search, classFilter]
  );

  const selected = selectedId
    ? mockCandidates.find((c) => c.id === selectedId) ?? null
    : null;

  const openDrawer = (id: string) => setSearchParams({ selected: id });
  const closeDrawer = () => setSearchParams({});

  const handleSubmitNew = () => {
    setModalOpen(false);
    showToast("Aday başarıyla kaydedildi");
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

      <PageTabs active={tab} onChange={setTab} tabs={TABS} />

      <div className="search-box">
        <SearchInput
          onChange={setSearch}
          placeholder="Aday ara... (ad, soyad, TC)"
          value={search}
        />
        {CLASS_FILTERS.map((f) => (
          <FilterChip
            active={f.key === classFilter}
            icon={f.key === "all" ? <FilterIcon size={12} /> : undefined}
            key={f.key}
            onClick={() => setClassFilter(f.key)}
          >
            {f.label}
          </FilterChip>
        ))}
      </div>

      <div className="table-wrap">
        <table className="data-table cand-table">
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>TC Kimlik</th>
              <th>Sınıf</th>
              <th>Grup</th>
              <th>Evrak</th>
              <th>Bakiye</th>
              <th>MEB Durumu</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} onClick={() => openDrawer(c.id)}>
                <td><span className="cand-name">{c.fullName}</span></td>
                <td><span className="cand-tc">{c.tc}</span></td>
                <td><span className="cand-class-badge">{c.className}</span></td>
                <td>{c.term}</td>
                <td><DocProgress done={c.docsDone} total={c.docsTotal} /></td>
                <td>
                  <span className={c.balance < 0 ? "cand-balance negative" : "cand-balance clear"}>
                    {formatBalance(c.balance)}
                  </span>
                </td>
                <td><StatusPill status={c.mebStatus} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="data-table-empty" colSpan={7}>
                  Eşleşen aday bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CandidateDrawer
        candidate={selected}
        onClose={closeDrawer}
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
