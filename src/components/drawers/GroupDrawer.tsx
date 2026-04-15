import { useEffect, useMemo, useRef, useState } from "react";

import {
  assignCandidateGroup,
  getCandidates,
  removeActiveGroupAssignment,
} from "../../lib/candidates-api";
import { getGroupById, updateGroup } from "../../lib/groups-api";
import { useLanguage } from "../../lib/i18n";
import {
  formatDateTR,
  groupMebStatusLabel,
  GROUP_MEB_STATUS_OPTIONS,
  LICENSE_CLASS_OPTIONS,
  normalizeGroupMebStatusValue,
} from "../../lib/status-maps";
import { buildGroupHeading, buildTermLabel, compareTermsDesc } from "../../lib/term-label";
import { getTerms } from "../../lib/terms-api";
import type {
  GroupDetailResponse,
  GroupUpsertRequest,
  LicenseClass,
  TermResponse,
} from "../../lib/types";
import { PlusIcon, XIcon } from "../icons";
import { Drawer, DrawerRow, DrawerSection } from "../ui/Drawer";
import { EditableRow } from "../ui/EditableRow";
import type { SelectOption } from "../ui/EditableRow";
import { useToast } from "../ui/Toast";

const MEB_STATUS_OPTIONS_WITH_EMPTY = [
  { value: "", label: "— Atanmamış —" },
  ...GROUP_MEB_STATUS_OPTIONS,
];

type GroupDrawerProps = {
  groupId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export function GroupDrawer({ groupId, onClose, onUpdated }: GroupDrawerProps) {
  const { showToast } = useToast();
  const { lang } = useLanguage();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const [group, setGroup] = useState<GroupDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [terms, setTerms] = useState<TermResponse[]>([]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; firstName: string; lastName: string; nationalId: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!groupId) {
      setGroup(null);
      setSearchOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    getGroupById(groupId, controller.signal)
      .then((data) => setGroup(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGroup(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [groupId]);

  // Load term catalog lazily so the term selector can build the correct
  // "Nisan 2026 / 2" style labels and so the user can reassign the group to
  // another term.
  useEffect(() => {
    if (!groupId) return;
    const controller = new AbortController();
    getTerms({ pageSize: 200 }, controller.signal)
      .then((result) => setTerms(result.items))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setTerms([]);
      });
    return () => controller.abort();
  }, [groupId]);

  const sortedTerms = useMemo(() => [...terms].sort(compareTermsDesc), [terms]);

  const termOptions: SelectOption[] = useMemo(() => {
    if (sortedTerms.length === 0 && group) {
      // Ensure the current term is always selectable even before the catalog
      // finishes loading.
      return [{ value: group.term.id, label: buildTermLabel(group.term, [group.term], lang) }];
    }
    return sortedTerms.map((term) => ({
      value: term.id,
      label: buildTermLabel(term, sortedTerms, lang),
    }));
  }, [sortedTerms, group, lang]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const result = await getCandidates({ search: searchQuery, pageSize: 20 });
        const activeCandidateIds = new Set(group?.activeCandidates.map((c) => c.candidateId) ?? []);
        setSearchResults(
          result.items
            .filter((c) => !activeCandidateIds.has(c.id) && c.licenseClass === group?.licenseClass)
            .map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, nationalId: c.nationalId }))
        );
      } catch {
        /* ignore */
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, group]);

  const refreshGroup = async () => {
    if (!groupId) return;
    const updated = await getGroupById(groupId);
    setGroup(updated);
    onUpdated?.();
  };

  const saveField = async (patch: Partial<GroupUpsertRequest>) => {
    if (!group || !groupId || !group.startDate) return;
    try {
      const updated = await updateGroup(groupId, {
        title: group.title,
        licenseClass: group.licenseClass,
        termId: group.term.id,
        capacity: group.capacity,
        startDate: group.startDate,
        mebStatus: normalizeGroupMebStatusValue(group.mebStatus),
        ...patch,
      });
      setGroup({ ...updated, activeCandidates: group.activeCandidates });
      onUpdated?.();
    } catch {
      showToast("Değişiklik kaydedilemedi", "error");
      throw new Error("save failed");
    }
  };

  const handleRemoveCandidate = async (candidateId: string) => {
    if (!groupId) return;
    setRemoving(candidateId);
    try {
      await removeActiveGroupAssignment(candidateId);
      await refreshGroup();
    } catch {
      showToast("Aday kaldırılamadı", "error");
    } finally {
      setRemoving(null);
    }
  };

  const handleAddCandidate = async (candidateId: string) => {
    if (!groupId) return;
    setAdding(candidateId);
    try {
      await assignCandidateGroup(candidateId, groupId);
      setSearchQuery("");
      setSearchResults([]);
      await refreshGroup();
    } catch {
      showToast("Aday eklenemedi", "error");
    } finally {
      setAdding(null);
    }
  };

  if (!groupId) return null;

  const canEdit = true;

  const title = loading
    ? "Grup Detayı"
    : group
    ? buildGroupHeading(group.title, group.term, sortedTerms, lang, group.licenseClass)
    : "Grup Detayı";

  return (
    <Drawer onClose={onClose} open title={title}>
      {loading ? (
        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--gray-500)", fontSize: 13 }}>
          Yükleniyor...
        </div>
      ) : group ? (
        <>
          <DrawerSection title="Grup Bilgileri">
            <EditableRow
              displayValue={group.title}
              inputValue={group.title}
              label="Başlık"
              onSave={(v) => saveField({ title: v })}
            />
            <EditableRow
              displayValue={buildTermLabel(group.term, sortedTerms, lang)}
              inputValue={group.term.id}
              label="Dönem"
              options={termOptions}
              onSave={(v) => saveField({ termId: v })}
            />
            <EditableRow
              displayValue={group.licenseClass}
              inputValue={group.licenseClass}
              label="Sınıf"
              options={LICENSE_CLASS_OPTIONS}
              onSave={(v) => saveField({ licenseClass: v as LicenseClass })}
            />
            <EditableRow
              displayValue={String(group.capacity)}
              inputType="number"
              inputValue={String(group.capacity)}
              label="Kapasite"
              onSave={(v) => saveField({ capacity: Number(v) })}
            />
            <EditableRow
              displayValue={formatDateTR(group.startDate)}
              inputLang={dateInputLang}
              inputType="date"
              inputValue={group.startDate ?? ""}
              label="Başlangıç"
              onSave={(v) => saveField({ startDate: v })}
            />
            <EditableRow
              displayValue={groupMebStatusLabel(group.mebStatus)}
              inputValue={normalizeGroupMebStatusValue(group.mebStatus) ?? ""}
              label="MEB Durumu"
              options={MEB_STATUS_OPTIONS_WITH_EMPTY}
              onSave={(v) => saveField({ mebStatus: v || null })}
            />
            <DrawerRow label="Kayıt Tarihi">{formatDateTR(group.createdAtUtc)}</DrawerRow>
          </DrawerSection>

          <DrawerSection title={`Adaylar (${group.activeCandidates.length} / ${group.capacity})`}>
            {group.activeCandidates.length === 0 ? (
              <div className="drawer-empty-hint">Henüz aday atanmamış.</div>
            ) : (
              group.activeCandidates.map((c) => (
                <div key={c.candidateId} className="drawer-row candidate-list-row">
                  <span className="value" style={{ flex: 1 }}>
                    {c.firstName} {c.lastName}
                    <span className="candidate-tc">{c.nationalId}</span>
                  </span>
                  {canEdit && (
                    <button
                      className="icon-btn"
                      disabled={removing === c.candidateId}
                      onClick={() => handleRemoveCandidate(c.candidateId)}
                      title="Gruptan Çıkar"
                      type="button"
                    >
                      <XIcon size={13} />
                    </button>
                  )}
                </div>
              ))
            )}

            {canEdit && (
            <div className="candidate-search-add">
              {!searchOpen ? (
                <button
                  className="btn btn-secondary btn-sm candidate-add-btn"
                  onClick={() => setSearchOpen(true)}
                  type="button"
                >
                  <PlusIcon size={12} />
                  Aday Ekle
                </button>
              ) : (
                <div className="candidate-search-panel">
                  <div className="candidate-search-row">
                    <input
                      autoFocus
                      className="form-input-sm"
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="İsim veya TC ara..."
                      type="text"
                      value={searchQuery}
                    />
                    <button
                      className="icon-btn"
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                      type="button"
                    >
                      <XIcon size={13} />
                    </button>
                  </div>
                  {searchLoading && (
                    <div className="candidate-search-hint">Aranıyor...</div>
                  )}
                  {!searchLoading && searchResults.length > 0 && (
                    <ul className="candidate-search-results">
                      {searchResults.map((c) => (
                        <li key={c.id}>
                          <button
                            disabled={adding === c.id}
                            onClick={() => handleAddCandidate(c.id)}
                            type="button"
                          >
                            <span className="candidate-name">{c.firstName} {c.lastName}</span>
                            <span className="candidate-tc">{c.nationalId}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
                    <div className="candidate-search-hint">Sonuç bulunamadı.</div>
                  )}
                </div>
              )}
            </div>
            )}
          </DrawerSection>
        </>
      ) : (
        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--gray-500)", fontSize: 13 }}>
          Grup bilgisi yüklenemedi.
        </div>
      )}
    </Drawer>
  );
}
