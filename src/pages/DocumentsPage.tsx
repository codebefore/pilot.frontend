import { useMemo, useState } from "react";

import { PageTabs, PageToolbar } from "../components/layout/PageToolbar";
import { UploadDocumentModal } from "../components/modals/UploadDocumentModal";
import { Panel } from "../components/ui/Panel";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { mockCandidates } from "../mock/candidates";
import { mockMissingDocuments, type MissingDocument } from "../mock/documents";

type DocumentTab = "missing" | "all" | "soon";

const TABS: { key: DocumentTab; label: string }[] = [
  { key: "missing", label: "Eksik Evraklar" },
  { key: "all",     label: "Tüm Evraklar" },
  { key: "soon",    label: "Süresi Yaklaşan" },
];

function applyTab(docs: MissingDocument[], tab: DocumentTab): MissingDocument[] {
  switch (tab) {
    case "missing": return docs;
    case "all":     return docs;
    case "soon":    return docs.filter((d) => d.urgency !== "normal");
  }
}

function candidateIdByName(name: string): string | undefined {
  return mockCandidates.find((c) => c.fullName === name)?.id;
}

export function DocumentsPage() {
  const [tab, setTab] = useState<DocumentTab>("missing");
  const [modalOpen, setModalOpen] = useState(false);
  const [prefilledCandidateId, setPrefilledCandidateId] = useState<string | undefined>();
  const { showToast } = useToast();
  const filtered = useMemo(() => applyTab(mockMissingDocuments, tab), [tab]);

  const tabs = TABS.map((t) =>
    t.key === "missing"
      ? { ...t, label: `${t.label} (${mockMissingDocuments.length})` }
      : t
  );

  const openUpload = (candidateName?: string) => {
    setPrefilledCandidateId(candidateName ? candidateIdByName(candidateName) : undefined);
    setModalOpen(true);
  };

  return (
    <>
      <PageToolbar
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => openUpload()}
            type="button"
          >
            Evrak Yükle
          </button>
        }
        title="Evrak Takibi"
      />

      <PageTabs active={tab} onChange={setTab} tabs={tabs} />

      <div className="table-wrap spaced">
        <Panel>
          <table className="data-table">
            <thead>
              <tr>
                <th>Aday</th>
                <th>Eksik Evrak</th>
                <th>Son Tarih</th>
                <th>Öncelik</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td><span className="job-type">{d.candidate}</span></td>
                  <td>{d.missing}</td>
                  <td>
                    <span className={`doc-due-date ${d.urgency === "normal" ? "" : d.urgency}`.trim()}>
                      {d.dueDate}
                    </span>
                  </td>
                  <td><StatusPill label={d.pillLabel} status={d.pillStatus} /></td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openUpload(d.candidate)}
                      type="button"
                    >
                      Yükle
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="data-table-empty" colSpan={5}>
                    Bu sekmede görünür evrak yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      </div>

      <UploadDocumentModal
        initialCandidateId={prefilledCandidateId}
        onClose={() => setModalOpen(false)}
        onSubmit={() => {
          setModalOpen(false);
          showToast("Evrak yüklendi");
        }}
        open={modalOpen}
      />
    </>
  );
}
