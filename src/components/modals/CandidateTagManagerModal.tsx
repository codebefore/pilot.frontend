import { useEffect, useMemo, useState } from "react";

import { deleteCandidateTag, updateCandidateTag } from "../../lib/candidates-api";
import { ApiError } from "../../lib/http";
import type { CandidateTag } from "../../lib/types";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type CandidateTagManagerModalProps = {
  open: boolean;
  tags: CandidateTag[];
  onClose: () => void;
  onDeleted: (tag: CandidateTag) => void;
  onRenamed: (previousTag: CandidateTag, nextTag: CandidateTag) => void;
};

function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function usageLabel(count: number): string {
  return count === 1 ? "1 aday" : `${count} aday`;
}

export function CandidateTagManagerModal({
  open,
  tags,
  onClose,
  onDeleted,
  onRenamed,
}: CandidateTagManagerModalProps) {
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setDraftName("");
      setSavingId(null);
      setConfirmDeleteId(null);
    }
  }, [open]);

  const sortedTags = useMemo(
    () =>
      [...tags].sort((left, right) => left.name.localeCompare(right.name, "tr")),
    [tags]
  );

  const startEditing = (tag: CandidateTag) => {
    setEditingId(tag.id);
    setDraftName(tag.name);
    setConfirmDeleteId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftName("");
  };

  const handleRename = async (tag: CandidateTag) => {
    const nextName = normalizeTagName(draftName);
    if (!nextName) {
      showToast("Etiket adı boş olamaz", "error");
      return;
    }

    setSavingId(tag.id);

    try {
      const saved = await updateCandidateTag(tag.id, nextName);
      onRenamed(tag, saved);
      showToast(saved.id === tag.id ? "Etiket güncellendi" : "Etiket birleştirildi");
      cancelEditing();
    } catch (error) {
      if (error instanceof ApiError) {
        const firstMessage = Object.values(error.validationErrors ?? {})[0]?.[0];
        if (firstMessage) {
          showToast(firstMessage, "error");
        } else {
          showToast("Etiket güncellenemedi", "error");
        }
      } else {
        showToast("Etiket güncellenemedi", "error");
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (tag: CandidateTag) => {
    setSavingId(tag.id);

    try {
      await deleteCandidateTag(tag.id);
      onDeleted(tag);
      showToast("Etiket silindi");
      setConfirmDeleteId(null);
      if (editingId === tag.id) {
        cancelEditing();
      }
    } catch {
      showToast("Etiket silinemedi", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Modal
      footer={
        <button className="btn btn-secondary" onClick={onClose} type="button">
          Kapat
        </button>
      }
      onClose={onClose}
      open={open}
      title="Etiket Yönetimi"
    >
      {sortedTags.length === 0 ? (
        <div className="tag-manager-empty">Henüz etiket yok.</div>
      ) : (
        <div className="tag-manager-list">
          {sortedTags.map((tag) => {
            const isEditing = editingId === tag.id;
            const isConfirmingDelete = confirmDeleteId === tag.id;
            const isSaving = savingId === tag.id;
            const count = tag.usageCount ?? 0;

            return (
              <div className="tag-manager-row" key={tag.id}>
                <div className="tag-manager-meta">
                  {isEditing ? (
                    <input
                      aria-label={`${tag.name} etiket adı`}
                      className="form-input"
                      disabled={isSaving}
                      onChange={(event) => setDraftName(event.target.value)}
                      type="text"
                      value={draftName}
                    />
                  ) : (
                    <div className="tag-manager-name">{tag.name}</div>
                  )}
                  <div className="tag-manager-usage">
                    {usageLabel(count)}
                    {isConfirmingDelete ? " sistem genelinde kaldırılacak." : " kullanıyor."}
                  </div>
                </div>
                <div className="tag-manager-actions">
                  {isEditing ? (
                    <>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={isSaving}
                        onClick={cancelEditing}
                        type="button"
                      >
                        Vazgeç
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isSaving}
                        onClick={() => void handleRename(tag)}
                        type="button"
                      >
                        {isSaving ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                    </>
                  ) : isConfirmingDelete ? (
                    <>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={isSaving}
                        onClick={() => setConfirmDeleteId(null)}
                        type="button"
                      >
                        Vazgeç
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={isSaving}
                        onClick={() => void handleDelete(tag)}
                        type="button"
                      >
                        {isSaving ? "Siliniyor..." : "Evet, Sil"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEditing(tag)}
                        type="button"
                      >
                        Düzenle
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          setConfirmDeleteId(tag.id);
                          setEditingId(null);
                        }}
                        type="button"
                      >
                        Sil
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
