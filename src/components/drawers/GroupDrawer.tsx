import { useEffect, useMemo, useRef, useState } from "react";

import {
  assignCandidateGroup,
  getCandidates,
  removeActiveGroupAssignment,
} from "../../lib/candidates-api";
import { deleteGroup, getGroupById, updateGroup } from "../../lib/groups-api";
import {
  parseGroupTitle,
  GROUP_BRANCH_VALUES,
  GROUP_NUMBER_VALUES,
} from "../../lib/group-code";
import { ApiError } from "../../lib/http";
import { useLanguage } from "../../lib/i18n";
import { normalizeTextQuery } from "../../lib/search";
import {
  formatDateTR,
  groupMebStatusLabel,
  GROUP_MEB_STATUS_OPTIONS,
  normalizeGroupMebStatusValue,
} from "../../lib/status-maps";
import { buildGroupHeading, buildTermLabel, compareTermsDesc } from "../../lib/term-label";
import { getTerms } from "../../lib/terms-api";
import type {
  GroupDetailResponse,
  GroupUpdateRequest,
  TermResponse,
} from "../../lib/types";
import { CheckIcon, PencilIcon, PlusIcon, XIcon } from "../icons";
import { Drawer, DrawerRow, DrawerSection } from "../ui/Drawer";
import { CustomSelect } from "../ui/CustomSelect";
import { EditableRow } from "../ui/EditableRow";
import type { SelectOption } from "../ui/EditableRow";
import { useToast } from "../ui/Toast";

type GroupDrawerProps = {
  groupId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
  onDeleted?: () => void;
};

export function GroupDrawer({ groupId, onClose, onUpdated, onDeleted }: GroupDrawerProps) {
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!groupId) {
      setGroup(null);
      setSearchOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      setConfirmDelete(false);
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
    const normalizedSearchQuery = normalizeTextQuery(searchQuery);
    if (!normalizedSearchQuery) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const result = await getCandidates({ search: normalizedSearchQuery, pageSize: 20 });
        const activeCandidateIds = new Set(group?.activeCandidates.map((c) => c.candidateId) ?? []);
        setSearchResults(
          result.items
            .filter((c) => !activeCandidateIds.has(c.id))
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

  const saveField = async (patch: Partial<GroupUpdateRequest>) => {
    if (!group || !groupId || !group.startDate) return;
    try {
      const updated = await updateGroup(groupId, {
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

  const handleDeleteConfirm = async () => {
    if (!groupId) return;
    setDeleting(true);
    try {
      await deleteGroup(groupId);
      showToast("Grup silindi");
      onDeleted?.();
    } catch (error) {
      if (error instanceof ApiError) {
        const message =
          error.validationErrors?.group?.[0] ??
          error.validationErrors?.Group?.[0];
        if (message) {
          showToast(message, "error");
        } else {
          showToast("Grup silinemedi", "error");
        }
      } else {
        showToast("Grup silinemedi", "error");
      }
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (!groupId) return null;

  const canEdit = true;

  const title = loading
    ? "Grup Detayı"
    : group
    ? buildGroupHeading(group.title, group.term, sortedTerms, lang)
    : "Grup Detayı";
  const effectiveSearchQuery = normalizeTextQuery(searchQuery);

  const actions = confirmDelete ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <span style={{ fontSize: 13, color: "var(--gray-600)", flex: 1 }}>Emin misiniz?</span>
      <button
        className="btn btn-secondary btn-sm"
        disabled={deleting}
        onClick={() => setConfirmDelete(false)}
        type="button"
      >
        Vazgeç
      </button>
      <button
        className="btn btn-danger btn-sm"
        disabled={deleting}
        onClick={handleDeleteConfirm}
        type="button"
      >
        {deleting ? "Siliniyor..." : "Evet, Sil"}
      </button>
    </div>
  ) : (
    <button
      className="btn btn-danger btn-sm"
      disabled={loading}
      onClick={() => setConfirmDelete(true)}
      type="button"
    >
      Grup Sil
    </button>
  );

  return (
    <Drawer actions={actions} onClose={onClose} open title={title}>
      {loading ? (
        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--gray-500)", fontSize: 13 }}>
          Yükleniyor...
        </div>
      ) : group ? (
        <>
          <DrawerSection title="Grup Bilgileri">
            <GroupCodeEditableRow
              title={group.title}
              onSave={(groupNumber, groupBranch) =>
                saveField({
                  groupNumber: Number(groupNumber),
                  groupBranch,
                })
              }
            />
            <EditableRow
              displayValue={buildTermLabel(group.term, sortedTerms, lang)}
              inputValue={group.term.id}
              label="Dönem"
              options={termOptions}
              onSave={(v) => saveField({ termId: v })}
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
              options={GROUP_MEB_STATUS_OPTIONS}
              onSave={(v) => saveField({ mebStatus: v })}
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
                  {!searchLoading && effectiveSearchQuery && searchResults.length === 0 && (
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

type GroupCodeEditableRowProps = {
  title: string;
  onSave: (groupNumber: string, groupBranch: string) => Promise<void>;
};

function GroupCodeEditableRow({ title, onSave }: GroupCodeEditableRowProps) {
  const initialCode = parseGroupTitle(title);
  const [editing, setEditing] = useState(false);
  const [groupNumber, setGroupNumber] = useState(initialCode?.groupNumber ?? GROUP_NUMBER_VALUES[0]);
  const [groupBranch, setGroupBranch] = useState(initialCode?.groupBranch ?? GROUP_BRANCH_VALUES[0]);
  const [saving, setSaving] = useState(false);
  const isEditable = initialCode !== null;

  useEffect(() => {
    const next = parseGroupTitle(title);
    if (!next) {
      setEditing(false);
      return;
    }

    setGroupNumber(next.groupNumber);
    setGroupBranch(next.groupBranch);
  }, [title]);

  const startEdit = () => {
    const next = parseGroupTitle(title);
    if (!next) {
      return;
    }

    setGroupNumber(next.groupNumber);
    setGroupBranch(next.groupBranch);
    setEditing(true);
  };

  const cancel = () => {
    const next = parseGroupTitle(title);
    if (!next) {
      setEditing(false);
      return;
    }

    setGroupNumber(next.groupNumber);
    setGroupBranch(next.groupBranch);
    setEditing(false);
  };

  const save = async () => {
    const currentCode = parseGroupTitle(title);
    if (
      currentCode?.groupNumber === groupNumber &&
      currentCode.groupBranch === groupBranch.trim().toUpperCase()
    ) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(groupNumber, groupBranch);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="drawer-row editable-row">
      {!editing && <span className="label">Başlık</span>}
      {editing ? (
        <span className="editable-row-edit">
          <CustomSelect
            className="form-select-sm"
            disabled={saving}
            onChange={(event) => setGroupNumber(event.target.value)}
            value={groupNumber}
          >
            {GROUP_NUMBER_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </CustomSelect>
          <CustomSelect
            className="form-select-sm"
            disabled={saving}
            onChange={(event) => setGroupBranch(event.target.value)}
            value={groupBranch}
          >
            {GROUP_BRANCH_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </CustomSelect>
          <button
            className="icon-btn icon-btn-confirm"
            disabled={saving}
            onClick={save}
            title="Kaydet"
            type="button"
          >
            <CheckIcon size={13} />
          </button>
          <button
            className="icon-btn"
            disabled={saving}
            onClick={cancel}
            title="Vazgeç"
            type="button"
          >
            <XIcon size={13} />
          </button>
        </span>
      ) : (
        <span className="editable-row-view">
          <span className="value">{title || "—"}</span>
          {isEditable ? (
            <button className="icon-btn edit-trigger" onClick={startEdit} title="Düzenle" type="button">
              <PencilIcon size={12} />
            </button>
          ) : null}
        </span>
      )}
    </div>
  );
}
