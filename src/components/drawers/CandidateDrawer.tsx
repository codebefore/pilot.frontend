import { useEffect, useState } from "react";

import {
  assignCandidateGroup,
  deleteCandidate,
  getCandidateById,
  removeActiveGroupAssignment,
  updateCandidate,
} from "../../lib/candidates-api";
import { getDocumentChecklist } from "../../lib/documents-api";
import { getGroups } from "../../lib/groups-api";
import { useLanguage } from "../../lib/i18n";
import { buildTermLabel, compareTermsDesc } from "../../lib/term-label";
import { getTerms } from "../../lib/terms-api";
import {
  candidateStatusLabel,
  CANDIDATE_STATUS_OPTIONS,
  formatDateTR,
  LICENSE_CLASS_OPTIONS,
  normalizeCandidateStatusValue,
} from "../../lib/status-maps";
import type { CandidateResponse, CandidateUpsertRequest, LicenseClass } from "../../lib/types";
import { UploadDocumentModal } from "../modals/UploadDocumentModal";
import { Drawer, DrawerRow, DrawerSection } from "../ui/Drawer";
import { EditableRow } from "../ui/EditableRow";
import type { SelectOption } from "../ui/EditableRow";
import { useToast } from "../ui/Toast";

function groupTermLabel(title: string, licenseClass: string): string {
  const prefix = `${licenseClass} Sinifi - `;
  return title.startsWith(prefix) ? title.slice(prefix.length) : title;
}

/* ── Drawer ── */

type CandidateDrawerProps = {
  candidateId: string | null;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated?: () => void;
  onStartMebJob: () => void;
  onTakePayment: () => void;
};

const STATUS_OPTIONS: SelectOption[] = CANDIDATE_STATUS_OPTIONS;

export function CandidateDrawer({
  candidateId,
  onClose,
  onDeleted,
  onUpdated,
  onStartMebJob,
  onTakePayment,
}: CandidateDrawerProps) {
  const { showToast } = useToast();
  const { lang } = useLanguage();
  const [candidate, setCandidate] = useState<CandidateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [missingDocs, setMissingDocs] = useState<string[] | null>(null);

  useEffect(() => {
    if (!candidateId) {
      setCandidate(null);
      setConfirmDelete(false);
      setMissingDocs(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    getCandidateById(candidateId, controller.signal)
      .then((data) => setCandidate(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCandidate(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [candidateId]);

  // Lazy-load missing document names from the checklist endpoint. Skipped when
  // the candidate has no missing documents to keep the drawer fast.
  useEffect(() => {
    if (!candidate || !candidate.documentSummary) {
      setMissingDocs(null);
      return;
    }
    if (candidate.documentSummary.missingCount === 0) {
      setMissingDocs([]);
      return;
    }
    const controller = new AbortController();
    getDocumentChecklist(
      { status: "missing", search: candidate.nationalId, page: 1, pageSize: 1 },
      controller.signal
    )
      .then((result) => setMissingDocs(result.items[0]?.missingDocumentNames ?? []))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setMissingDocs(null);
      });
    return () => controller.abort();
  }, [candidate]);

  const saveField = async (patch: Partial<CandidateUpsertRequest>) => {
    if (!candidate || !candidateId) return;
    try {
      const updated = await updateCandidate(candidateId, {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        nationalId: candidate.nationalId,
        phoneNumber: candidate.phoneNumber,
        email: candidate.email,
        birthDate: candidate.birthDate,
        licenseClass: candidate.licenseClass,
        status: normalizeCandidateStatusValue(candidate.status),
        ...patch,
      });
      setCandidate(updated);
      onUpdated?.();
    } catch {
      showToast("Değişiklik kaydedilemedi", "error");
      throw new Error("save failed");
    }
  };

  const saveGroup = async (groupId: string) => {
    if (!candidateId) return;
    try {
      if (!groupId) {
        await removeActiveGroupAssignment(candidateId);
      } else {
        await assignCandidateGroup(candidateId, groupId);
      }
      const updated = await getCandidateById(candidateId);
      setCandidate(updated);
      onUpdated?.();
    } catch {
      showToast("Grup ataması kaydedilemedi", "error");
      throw new Error("save failed");
    }
  };

  const loadGroupOptions = async (): Promise<SelectOption[]> => {
    const [groupsResult, termsResult] = await Promise.all([
      getGroups({ pageSize: 100 }),
      getTerms({ pageSize: 200 }).catch(() => ({ items: [] })),
    ]);
    const filtered = groupsResult.items.filter(
      (g) => !candidate?.licenseClass || g.licenseClass === candidate.licenseClass
    );
    const sortedTerms = [...termsResult.items].sort(compareTermsDesc);
    return [
      { value: "", label: "— Atanmamış —" },
      ...filtered.map((g) => {
        const termLabel = buildTermLabel(
          g.term,
          sortedTerms.length > 0 ? sortedTerms : [g.term],
          lang
        );
        return { value: g.id, label: `${g.title} · ${termLabel}` };
      }),
    ];
  };

  const handleDeleteConfirm = async () => {
    if (!candidateId) return;
    setDeleting(true);
    try {
      await deleteCandidate(candidateId);
      showToast("Aday silindi");
      onDeleted();
    } catch {
      showToast("Aday silinemedi", "error");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (!candidateId) return null;

  const title = loading
    ? "Aday Detayı"
    : candidate
    ? `${candidate.firstName} ${candidate.lastName}`
    : "Aday Detayı";

  const actions = confirmDelete ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <span style={{ fontSize: 13, color: "var(--gray-600)", flex: 1 }}>Emin misiniz?</span>
      <button className="btn btn-secondary btn-sm" disabled={deleting} onClick={() => setConfirmDelete(false)} type="button">Vazgeç</button>
      <button className="btn btn-danger btn-sm" disabled={deleting} onClick={handleDeleteConfirm} type="button">
        {deleting ? "Siliniyor..." : "Evet, Sil"}
      </button>
    </div>
  ) : (
    <>
      <button className="btn btn-primary btn-sm" onClick={onStartMebJob} type="button">MEB İşi Başlat</button>
      <button className="btn btn-secondary btn-sm" onClick={onTakePayment} type="button">Tahsilat Al</button>
      <button
        className="btn btn-secondary btn-sm"
        disabled={!candidate}
        onClick={() => setUploadOpen(true)}
        type="button"
      >
        Evrak Yükle
      </button>
      <button className="btn btn-danger btn-sm" disabled={loading} onClick={() => setConfirmDelete(true)} type="button">Aday Sil</button>
    </>
  );

  return (
    <Drawer actions={actions} onClose={onClose} open title={title}>
      {loading ? (
        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--gray-500)", fontSize: 13 }}>
          Yükleniyor...
        </div>
      ) : candidate ? (
        <>
          <DrawerSection title="Kişisel Bilgiler">
            <EditableRow
              displayValue={candidate.firstName}
              inputValue={candidate.firstName}
              label="Ad"
              onSave={(v) => saveField({ firstName: v })}
            />
            <EditableRow
              displayValue={candidate.lastName}
              inputValue={candidate.lastName}
              label="Soyad"
              onSave={(v) => saveField({ lastName: v })}
            />
            <EditableRow
              displayValue={candidate.nationalId}
              inputType="tel"
              inputValue={candidate.nationalId}
              label="TC Kimlik"
              onSave={(v) => saveField({ nationalId: v })}
            />
            <EditableRow
              displayValue={formatDateTR(candidate.birthDate)}
              inputType="date"
              inputValue={candidate.birthDate ?? ""}
              label="Doğum Tarihi"
              onSave={(v) => saveField({ birthDate: v || null })}
            />
            <EditableRow
              displayValue={candidate.phoneNumber ?? ""}
              inputType="tel"
              inputValue={candidate.phoneNumber ?? ""}
              label="Telefon"
              onSave={(v) => saveField({ phoneNumber: v || null })}
            />
            <EditableRow
              displayValue={candidate.email ?? ""}
              inputType="email"
              inputValue={candidate.email ?? ""}
              label="E-posta"
              onSave={(v) => saveField({ email: v || null })}
            />
          </DrawerSection>

          <DrawerSection title="Kayıt Bilgileri">
            <EditableRow
              displayValue={candidate.licenseClass}
              inputValue={candidate.licenseClass}
              label="Sınıf"
              options={LICENSE_CLASS_OPTIONS}
              onSave={(v) => saveField({ licenseClass: v as LicenseClass })}
            />
            <EditableRow
              key={candidate.licenseClass}
              displayValue={
                candidate.currentGroup
                  ? groupTermLabel(candidate.currentGroup.title, candidate.licenseClass)
                  : "Atanmamış"
              }
              inputValue={candidate.currentGroup?.groupId ?? ""}
              label="Dönem"
              loadOptions={loadGroupOptions}
              onSave={saveGroup}
            />
            <DrawerRow label="Kayıt Tarihi">{formatDateTR(candidate.createdAtUtc)}</DrawerRow>
          </DrawerSection>

          <DrawerSection title="Durum">
            <EditableRow
              displayValue={candidateStatusLabel(candidate.status)}
              inputValue={normalizeCandidateStatusValue(candidate.status)}
              label="Durum"
              options={STATUS_OPTIONS}
              onSave={(v) => saveField({ status: v })}
            />
          </DrawerSection>

          <DrawerSection title="Evrak Durumu">
            {candidate.documentSummary ? (
              <>
                <DrawerRow label="Tamamlanan">
                  {candidate.documentSummary.completedCount} /{" "}
                  {candidate.documentSummary.totalRequiredCount}
                </DrawerRow>
                <DrawerRow
                  label="Eksik"
                  tone={candidate.documentSummary.missingCount > 0 ? "danger" : "default"}
                >
                  {candidate.documentSummary.missingCount}
                </DrawerRow>
                {missingDocs && missingDocs.length > 0 && (
                  <div className="drawer-row-list">
                    <ul className="drawer-list">
                      {missingDocs.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                <DrawerRow label="Tamamlanan">—</DrawerRow>
                <DrawerRow label="Eksik">—</DrawerRow>
              </>
            )}
          </DrawerSection>

          <DrawerSection title="Muhasebe">
            <DrawerRow label="Toplam Ücret">—</DrawerRow>
            <DrawerRow label="Ödenen">—</DrawerRow>
            <DrawerRow label="Kalan Bakiye">—</DrawerRow>
          </DrawerSection>
        </>
      ) : (
        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--gray-500)", fontSize: 13 }}>
          Aday bilgisi yüklenemedi.
        </div>
      )}

      <UploadDocumentModal
        candidateId={candidate ? candidateId : null}
        candidateName={candidate ? `${candidate.firstName} ${candidate.lastName}` : undefined}
        onClose={() => setUploadOpen(false)}
        onUploaded={async () => {
          setUploadOpen(false);
          showToast("Evrak yüklendi");
          // Refresh the in-drawer candidate so documentSummary + missing list
          // reflect the upload immediately.
          if (candidateId) {
            try {
              const fresh = await getCandidateById(candidateId);
              setCandidate(fresh);
            } catch {
              /* swallow — parent refresh will still run */
            }
          }
          onUpdated?.();
        }}
        open={uploadOpen}
      />
    </Drawer>
  );
}
