import { useEffect, useMemo, useState } from "react";

import { deleteCandidateTag, updateCandidateTag } from "../../lib/candidates-api";
import { ApiError } from "../../lib/http";
import type { CandidateTag } from "../../lib/types";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { useT, type TranslationKey } from "../../lib/i18n";

type CandidateTagManagerModalProps = {
  open: boolean;
  tags: CandidateTag[];
  canManage?: boolean;
  onClose: () => void;
  onDeleted: (tag: CandidateTag) => void;
  onRenamed: (previousTag: CandidateTag, nextTag: CandidateTag) => void;
};

function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function usageLabel(count: number, t: (key: TranslationKey, params?: Record<string, string | number>) => string): string {
  return count === 1 ? t("tagManager.usage.singular") : t("tagManager.usage.plural", { count });
}

export function CandidateTagManagerModal({
  open,
  tags,
  canManage = true,
  onClose,
  onDeleted,
  onRenamed,
}: CandidateTagManagerModalProps) {
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const t = useT();
  const noPermissionTitle = t("common.noPermission");

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
    if (!canManage) return;
    setEditingId(tag.id);
    setDraftName(tag.name);
    setConfirmDeleteId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftName("");
  };

  const handleRename = async (tag: CandidateTag) => {
    if (!canManage) return;
    const nextName = normalizeTagName(draftName);
    if (!nextName) {
      showToast(t("tagManager.toast.nameEmpty"), "error");
      return;
    }

    setSavingId(tag.id);

    try {
      const saved = await updateCandidateTag(tag.id, nextName);
      onRenamed(tag, saved);
      showToast(t(saved.id === tag.id ? "tagManager.toast.updated" : "tagManager.toast.merged"));
      cancelEditing();
    } catch (error) {
      if (error instanceof ApiError) {
        const firstMessage = Object.values(error.validationErrors ?? {})[0]?.[0];
        if (firstMessage) {
          showToast(firstMessage, "error");
        } else {
          showToast(t("tagManager.toast.updateFailed"), "error");
        }
      } else {
        showToast(t("tagManager.toast.updateFailed"), "error");
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (tag: CandidateTag) => {
    if (!canManage) return;
    setSavingId(tag.id);

    try {
      await deleteCandidateTag(tag.id);
      onDeleted(tag);
      showToast(t("tagManager.toast.deleted"));
      setConfirmDeleteId(null);
      if (editingId === tag.id) {
        cancelEditing();
      }
    } catch {
      showToast(t("tagManager.toast.deleteFailed"), "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Modal
      footer={
        <button className="btn btn-secondary" onClick={onClose} type="button">
          {t("common.close")}
        </button>
      }
      onClose={onClose}
      open={open}
      title={t("candidateTagManager.modalTitle")}
    >
      {sortedTags.length === 0 ? (
        <div className="tag-manager-empty">{t("tagManager.empty")}</div>
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
                      aria-label={t("tagManager.aria.tagName", { name: tag.name })}
                      className="form-input"
                      disabled={isSaving || !canManage}
                      onChange={(event) => setDraftName(event.target.value)}
                      title={!canManage ? noPermissionTitle : undefined}
                      type="text"
                      value={draftName}
                    />
                  ) : (
                    <div className="tag-manager-name">{tag.name}</div>
                  )}
                  <div className="tag-manager-usage">
                    {usageLabel(count, t)}
                    {isConfirmingDelete ? t("tagManager.deleteConfirm") : t("tagManager.inUse")}
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
                        {t("common.cancel")}
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isSaving || !canManage}
                        onClick={() => void handleRename(tag)}
                        title={!canManage ? noPermissionTitle : undefined}
                        type="button"
                      >
                        {isSaving ? t("common.saving") : t("common.save")}
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
                        {t("common.cancel")}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={isSaving || !canManage}
                        onClick={() => void handleDelete(tag)}
                        title={!canManage ? noPermissionTitle : undefined}
                        type="button"
                      >
                        {isSaving ? t("tagManager.confirm.deleting") : t("tagManager.confirm.yesDelete")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={!canManage}
                        onClick={() => startEditing(tag)}
                        title={!canManage ? noPermissionTitle : undefined}
                        type="button"
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={!canManage}
                        onClick={() => {
                          if (!canManage) return;
                          setConfirmDeleteId(tag.id);
                          setEditingId(null);
                        }}
                        title={!canManage ? noPermissionTitle : undefined}
                        type="button"
                      >
                        {t("common.delete")}
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
