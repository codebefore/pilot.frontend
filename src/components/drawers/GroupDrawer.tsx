import { useEffect, useRef, useState } from "react";

import {
  assignCandidateGroup,
  getCandidates,
  removeActiveGroupAssignment,
} from "../../lib/candidates-api";
import { getGroupById, updateGroup } from "../../lib/groups-api";
import {
  formatDateTR,
  groupMebStatusLabel,
  groupStatusLabel,
} from "../../lib/status-maps";
import type { GroupDetailResponse, GroupUpsertRequest, LicenseClass } from "../../lib/types";
import { PlusIcon, XIcon } from "../icons";
import { Drawer, DrawerRow, DrawerSection } from "../ui/Drawer";
import { EditableRow } from "../ui/EditableRow";
import type { SelectOption } from "../ui/EditableRow";
import { useToast } from "../ui/Toast";

const LICENSE_CLASS_OPTIONS: SelectOption[] = [
  { value: "B",  label: "B — Otomobil" },
  { value: "A2", label: "A2 — Motosiklet" },
  { value: "C",  label: "C — Kamyon" },
  { value: "D",  label: "D — Otobüs" },
  { value: "E",  label: "E — Dorseli" },
];

const GROUP_STATUS_OPTIONS: SelectOption[] = [
  { value: "draft",       label: "Taslak" },
  { value: "Aktif",       label: "Aktif" },
  { value: "Kapanista",   label: "Kapanışta" },
  { value: "Tamamlandi",  label: "Tamamlandı" },
];

const MEB_STATUS_OPTIONS: SelectOption[] = [
  { value: "",            label: "— Atanmamış —" },
  { value: "Bekliyor",    label: "Bekliyor" },
  { value: "Olusturuldu", label: "Oluşturuldu" },
  { value: "Manuel Onay", label: "Manuel Onay" },
  { value: "Kapandi",     label: "Kapandı" },
  { value: "Hata",        label: "Hata" },
];

type GroupDrawerProps = {
  groupId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export function GroupDrawer({ groupId, onClose, onUpdated }: GroupDrawerProps) {
  const { showToast } = useToast();
  const [group, setGroup] = useState<GroupDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (!group || !groupId) return;
    try {
      const updated = await updateGroup(groupId, {
        title: group.title,
        status: group.status,
        licenseClass: group.licenseClass,
        termName: group.termName,
        capacity: group.capacity,
        assignedCandidateCount: group.assignedCandidateCount,
        startDate: group.startDate,
        endDate: group.endDate,
        mebStatus: group.mebStatus,
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

  const canEdit = !group || ["aktif", "draft"].includes(group.status.toLowerCase());

  const title = loading
    ? "Grup Detayı"
    : group
    ? group.title
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
              displayValue={group.termName ?? "—"}
              inputValue={group.termName ?? ""}
              label="Dönem"
              onSave={(v) => saveField({ termName: v, title: `${group.licenseClass} Sinifi - ${v}` })}
            />
            <EditableRow
              displayValue={group.licenseClass}
              inputValue={group.licenseClass}
              label="Sınıf"
              options={LICENSE_CLASS_OPTIONS}
              onSave={(v) =>
                saveField({ licenseClass: v as LicenseClass, title: `${v} Sinifi - ${group.termName ?? ""}` })
              }
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
              inputType="date"
              inputValue={group.startDate ?? ""}
              label="Başlangıç"
              onSave={(v) => saveField({ startDate: v || null })}
            />
            <EditableRow
              displayValue={formatDateTR(group.endDate)}
              inputType="date"
              inputValue={group.endDate ?? ""}
              label="Bitiş"
              onSave={(v) => saveField({ endDate: v || null })}
            />
            <EditableRow
              displayValue={groupStatusLabel(group.status)}
              inputValue={group.status}
              label="Durum"
              options={GROUP_STATUS_OPTIONS}
              onSave={(v) => saveField({ status: v })}
            />
            <EditableRow
              displayValue={groupMebStatusLabel(group.mebStatus)}
              inputValue={group.mebStatus ?? ""}
              label="MEB Durumu"
              options={MEB_STATUS_OPTIONS}
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
