import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PencilIcon, PlusIcon, TrashIcon } from "../components/icons";
import { AssignmentDocumentFormModal } from "../components/modals/AssignmentDocumentFormModal";
import { InstructorAssignmentFormModal } from "../components/modals/InstructorAssignmentFormModal";
import { InstructorAvatar } from "../components/ui/InstructorAvatar";
import { LocalizedDateInput } from "../components/ui/LocalizedDateInput";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import { openAuthorizedFile } from "../lib/authorized-files";
import {
  deleteAssignment,
  deleteAssignmentDocument,
  getAssignmentDocumentDownloadUrl,
  listAssignments,
} from "../lib/instructor-assignments-api";
import {
  INSTRUCTOR_EMPLOYMENT_LABELS,
  INSTRUCTOR_ROLE_LABELS,
} from "../lib/instructor-catalog";
import {
  clearInstructorLeft,
  getInstructor,
  markInstructorLeft,
} from "../lib/instructors-api";
import { getTrainingBranchDefinitions } from "../lib/training-branch-definitions-api";
import { useT } from "../lib/i18n";
import { canManageArea } from "../lib/permissions";
import type { InstructorAssignment } from "../lib/types";

function formatFileSize(bytes: number | null): string | null {
  if (bytes == null || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function InstructorDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const canManageTraining = canManageArea(user, permissions, "training");
  const canManageDocuments = canManageArea(user, permissions, "documents");
  const noPermissionTitle = t("common.noPermission");
  const { instructorId } = useParams<{ instructorId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const instructorQuery = useQuery({
    queryKey: ["instructors", "detail", instructorId],
    queryFn: ({ signal }) => getInstructor(instructorId as string, signal),
    enabled: Boolean(instructorId),
  });
  const assignmentsQuery = useQuery({
    queryKey: ["instructorAssignments", instructorId],
    queryFn: () => listAssignments(instructorId as string),
    enabled: Boolean(instructorId),
  });
  const branchesQuery = useQuery({
    queryKey: ["trainingBranchDefinitions", "list", { activity: "all", page: 1, pageSize: 100 }],
    queryFn: ({ signal }) =>
      getTrainingBranchDefinitions({ activity: "all", page: 1, pageSize: 100 }, signal),
    enabled: Boolean(instructorId),
  });

  const instructor = instructorQuery.data ?? null;
  const assignments = assignmentsQuery.data ?? [];
  const branches = branchesQuery.data?.items ?? [];
  const loading =
    instructorQuery.isLoading || assignmentsQuery.isLoading || branchesQuery.isLoading;
  const error =
    instructorQuery.isError || assignmentsQuery.isError || branchesQuery.isError
      ? t("settings.instructors.errors.loadFailed")
      : null;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InstructorAssignment | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [docModalAssignmentId, setDocModalAssignmentId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveDate, setLeaveDate] = useState<string>("");
  const [leaveReason, setLeaveReason] = useState<string>("");
  const [leaveBusy, setLeaveBusy] = useState(false);

  const branchLabelMap = useMemo(() => {
    return branches.reduce<Record<string, string>>((acc, b) => {
      acc[b.code] = b.name;
      return acc;
    }, {});
  }, [branches]);
  const activeBranches = useMemo(() => branches.filter((branch) => branch.isActive), [branches]);

  const activeAssignmentId = assignments[0]?.id ?? null;

  useEffect(() => {
    if (loading) return;
    if (!instructor) return;
    if (searchParams.get("newAssignment") !== "1") return;
    setEditing(null);
    if (canManageTraining) {
      setModalOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("newAssignment");
    setSearchParams(next, { replace: true });
  }, [canManageTraining, instructor, loading, searchParams, setSearchParams]);

  const refreshAssignments = async () => {
    if (!instructorId) return;
    // Instructor header (MEBBİS, sözleşme tarihleri vb.) backend'de latest
    // assignment'tan flatten edildiği için atama değişince beraber yenile.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["instructorAssignments", instructorId] }),
      queryClient.invalidateQueries({ queryKey: ["instructors", "detail", instructorId] }),
    ]);
  };

  const handleSaved = async () => {
    setModalOpen(false);
    setEditing(null);
    await refreshAssignments();
  };

  const handleDocumentDelete = async (assignmentId: string, documentId: string) => {
    if (!canManageDocuments) return;
    if (!instructorId) return;
    setDeletingDocId(documentId);
    try {
      await deleteAssignmentDocument(instructorId, assignmentId, documentId);
      showToast(t("settings.instructors.detail.assignments.documents.toasts.deleted"));
      await refreshAssignments();
    } catch {
      showToast(
        t("settings.instructors.detail.assignments.documents.errors.deleteFailed"),
        "error"
      );
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleDelete = async (a: InstructorAssignment) => {
    if (!canManageTraining) return;
    if (!instructorId) return;
    setDeletingId(a.id);
    try {
      await deleteAssignment(instructorId, a.id, a.rowVersion);
      setConfirmDeleteId(null);
      showToast(t("settings.instructors.detail.assignments.toasts.deleted"));
      await refreshAssignments();
    } catch {
      showToast(t("settings.instructors.detail.assignments.errors.deleteFailed"), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const openLeaveModal = () => {
    if (!canManageTraining) return;
    if (!instructor) return;
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setLeaveDate(instructor.leftAtDate ?? iso);
    setLeaveReason(instructor.leaveReason ?? "");
    setLeaveModalOpen(true);
  };

  const submitLeave = async () => {
    if (!canManageTraining) return;
    if (!instructor || !instructorId || !leaveDate) return;
    setLeaveBusy(true);
    try {
      const updated = await markInstructorLeft(instructorId, {
        leftAtDate: leaveDate,
        reason: leaveReason.trim() || null,
        rowVersion: instructor.rowVersion,
      });
      queryClient.setQueryData(["instructors", "detail", instructorId], updated);
      setLeaveModalOpen(false);
      showToast("İşten ayrılma kaydedildi");
    } catch {
      showToast("İşten ayrılma kaydedilemedi", "error");
    } finally {
      setLeaveBusy(false);
    }
  };

  const restoreInstructor = async () => {
    if (!canManageTraining) return;
    if (!instructorId) return;
    setLeaveBusy(true);
    try {
      const updated = await clearInstructorLeft(instructorId);
      queryClient.setQueryData(["instructors", "detail", instructorId], updated);
      showToast("Eğitmen aktif duruma alındı");
    } catch {
      showToast("Aktif duruma alınamadı", "error");
    } finally {
      setLeaveBusy(false);
    }
  };

  return (
    <div className="instructor-detail">
      <div className="instructor-detail-breadcrumb">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate("/settings/definitions/instructors")}
          type="button"
        >
          ← {t("settings.instructors.detail.backToList")}
        </button>
      </div>

      {loading && (
        <div className="instructor-detail-card">
          <span className="skeleton" style={{ width: 240, height: 24 }} />
        </div>
      )}

      {!loading && error && (
        <div className="instructor-detail-card instructor-detail-error">{error}</div>
      )}

      {!loading && !error && instructor && (
        <>
          <header className="instructor-detail-card instructor-detail-header">
            <div className="instructor-detail-header-top">
              <InstructorAvatar instructor={instructor} size={64} />
              <div className="instructor-detail-header-main">
                <h2 className="instructor-detail-name">
                  {instructor.firstName} {instructor.lastName}
                </h2>
                <div className="instructor-detail-meta">
                  <span
                    className={`instructor-detail-status${instructor.isActive ? " active" : " inactive"}`}
                  >
                    {instructor.isActive ? t("common.statusActive") : t("common.statusInactive")}
                  </span>
                  {instructor.leftAtDate ? (
                    <span className="instructor-detail-leave-pill" title={instructor.leaveReason ?? undefined}>
                      Ayrıldı · {instructor.leftAtDate.slice(0, 10).split("-").reverse().join(".")}
                    </span>
                  ) : null}
                  {instructor.phoneNumber ? <span>{instructor.phoneNumber}</span> : null}
                  {instructor.email ? <span>{instructor.email}</span> : null}
                </div>
              </div>
              <div className="instructor-detail-header-actions">
                {instructor.leftAtDate ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={leaveBusy || !canManageTraining}
                    onClick={restoreInstructor}
                    title={!canManageTraining ? noPermissionTitle : undefined}
                    type="button"
                  >
                    Aktif Et
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={leaveBusy || !canManageTraining}
                    onClick={openLeaveModal}
                    title={!canManageTraining ? noPermissionTitle : undefined}
                    type="button"
                  >
                    İşten Ayrıldı
                  </button>
                )}
              </div>
            </div>

            <div className="instructor-detail-summary-grid">
              <Field label="TC Kimlik No" value={instructor.nationalId ?? "—"} />
              <Field
                label={t("instructor.detail.field.status")}
                value={INSTRUCTOR_EMPLOYMENT_LABELS[instructor.employmentType] ?? "—"}
              />
              <Field
                label="Görev"
                value={INSTRUCTOR_ROLE_LABELS[instructor.role] ?? "—"}
              />
              <Field
                label={t("instructor.detail.field.branch")}
                value={
                  instructor.branches.length > 0
                    ? instructor.branches
                        .map((b) => branchLabelMap[b] ?? b)
                        .join(", ")
                    : "—"
                }
              />
              <Field
                label={t("instructor.detail.field.weeklyHours")}
                value={
                  instructor.weeklyLessonHours != null
                    ? String(instructor.weeklyLessonHours)
                    : "—"
                }
              />
              <Field
                label="MEBBİS İzin No"
                value={instructor.mebbisPermitNo ?? "—"}
              />
              <Field
                label={t("instructor.detail.field.totalAssignments")}
                value={String(assignments.length)}
              />
              <Field
                label={t("instructor.detail.field.registrationDate")}
                value={formatDate(instructor.createdAtUtc.slice(0, 10))}
              />
            </div>

            {instructor.notes ? (
              <div className="instructor-detail-notes">
                <span className="instructor-detail-notes-label">Notlar</span>
                <p>{instructor.notes}</p>
              </div>
            ) : null}
          </header>

          <section className="instructor-detail-card">
            <div className="instructor-detail-section-header">
              <h3>{t("settings.instructors.detail.assignments.title")}</h3>
              {instructor.isActive ? (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!canManageTraining}
                  onClick={() => {
                    if (!canManageTraining) return;
                    setEditing(null);
                    setModalOpen(true);
                  }}
                  title={!canManageTraining ? noPermissionTitle : undefined}
                  type="button"
                >
                  <PlusIcon size={14} />
                  {t("settings.instructors.detail.assignments.add")}
                </button>
              ) : null}
            </div>

            {assignments.length === 0 ? (
              <div className="instructor-detail-empty">
                {t("settings.instructors.detail.assignments.empty")}
              </div>
            ) : (
              <ul className="assignment-list">
                {assignments.map((a) => {
                  const isActive = a.id === activeAssignmentId;
                  const isConfirming = confirmDeleteId === a.id;
                  return (
                    <li
                      className={`assignment-item${isActive ? " assignment-item-active" : ""}`}
                      key={a.id}
                    >
                      <div className="assignment-item-head">
                        <div className="assignment-item-seq">#{a.sequenceNumber}</div>
                        <div className="assignment-item-title">
                          {INSTRUCTOR_ROLE_LABELS[a.role]}
                        </div>
                        {isActive ? (
                          <span className="assignment-item-badge">
                            {t("settings.instructors.detail.assignments.active")}
                          </span>
                        ) : (
                          <span className="assignment-item-badge assignment-item-badge-inactive">
                            {t("settings.instructors.detail.assignments.inactive")}
                          </span>
                        )}
                        <div className="assignment-item-actions">
                          {isConfirming ? (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                disabled={deletingId === a.id}
                                onClick={() => setConfirmDeleteId(null)}
                                type="button"
                              >
                                {t("common.cancel")}
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={deletingId === a.id || !canManageTraining}
                                onClick={() => handleDelete(a)}
                                title={!canManageTraining ? noPermissionTitle : undefined}
                                type="button"
                              >
                                {deletingId === a.id
                                  ? t("settings.instructors.actions.deleting")
                                  : t("common.delete")}
                              </button>
                            </>
                          ) : (
                            <>
                              {instructor.isActive ? (
                                <button
                                  aria-label={t("common.edit")}
                                  className="icon-btn"
                                  disabled={!canManageTraining}
                                  onClick={() => {
                                    if (!canManageTraining) return;
                                    setEditing(a);
                                    setModalOpen(true);
                                  }}
                                  title={!canManageTraining ? noPermissionTitle : t("common.edit")}
                                  type="button"
                                >
                                  <PencilIcon size={14} />
                                </button>
                              ) : null}
                              <button
                                aria-label={t("common.delete")}
                                className="icon-btn icon-btn-danger"
                                disabled={deletingId !== null || !canManageTraining}
                                onClick={() => {
                                  if (!canManageTraining) return;
                                  setConfirmDeleteId(a.id);
                                }}
                                title={!canManageTraining ? noPermissionTitle : t("common.delete")}
                                type="button"
                              >
                                <TrashIcon size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="assignment-item-grid">
                        <Field
                          label={t("settings.instructors.detail.assignments.field.employmentType")}
                          value={INSTRUCTOR_EMPLOYMENT_LABELS[a.employmentType]}
                        />
                        <Field
                          label={t("settings.instructors.detail.assignments.field.branch")}
                          value={
                            a.branches.length > 0
                              ? a.branches.map((branch) => branchLabelMap[branch] ?? branch).join(", ")
                              : "—"
                          }
                        />
                        <Field
                          label={t("settings.instructors.detail.assignments.field.weeklyLessonHours")}
                          value={a.weeklyLessonHours != null ? String(a.weeklyLessonHours) : "—"}
                        />
                        <Field
                          label={t("settings.instructors.detail.assignments.field.mebPermitNo")}
                          value={a.mebPermitNo ?? "—"}
                        />
                        <Field
                          label={t("settings.instructors.detail.assignments.field.contractStart")}
                          value={formatDate(a.contractStartDate)}
                        />
                        <Field
                          label={t("settings.instructors.detail.assignments.field.contractEnd")}
                          value={formatDate(a.contractEndDate)}
                        />
                      </div>
                      <div className="assignment-item-docs">
                        <div className="assignment-item-docs-head">
                          <div className="assignment-item-docs-label">
                            {t("settings.instructors.detail.assignments.documents.title")}
                          </div>
                          {instructor.isActive ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={!canManageDocuments}
                              onClick={() => {
                                if (!canManageDocuments) return;
                                setDocModalAssignmentId(a.id);
                              }}
                              title={!canManageDocuments ? noPermissionTitle : undefined}
                              type="button"
                            >
                              <PlusIcon size={12} />
                              {t("settings.instructors.detail.assignments.documents.add")}
                            </button>
                          ) : null}
                        </div>
                        {a.documents.length === 0 ? (
                          <div className="assignment-item-docs-empty">
                            {t("settings.instructors.detail.assignments.documents.empty")}
                          </div>
                        ) : (
                          <ul className="assignment-doc-list">
                            {a.documents.map((d) => {
                              const sizeLabel = formatFileSize(d.fileSizeBytes);
                              const fileLine = [d.originalFileName, sizeLabel]
                                .filter(Boolean)
                                .join(" · ");
                              return (
                              <li className="assignment-doc-item" key={d.id}>
                                <div className="assignment-doc-text">
                                  {d.originalFileName ? (
                                    <button
                                      className="assignment-doc-name"
                                      onClick={() => {
                                        void openAuthorizedFile(
                                          getAssignmentDocumentDownloadUrl(a.instructorId, a.id, d.id)
                                        );
                                      }}
                                      type="button"
                                    >
                                      <strong>{d.name}</strong>
                                    </button>
                                  ) : (
                                    <strong>{d.name}</strong>
                                  )}
                                  {d.description ? (
                                    <span className="assignment-doc-desc">{d.description}</span>
                                  ) : null}
                                  {fileLine ? (
                                    <span className="assignment-doc-file">{fileLine}</span>
                                  ) : null}
                                </div>
                                <button
                                  aria-label={t("common.delete")}
                                  className="icon-btn icon-btn-danger"
                                  disabled={deletingDocId === d.id || !canManageDocuments}
                                  onClick={() => handleDocumentDelete(a.id, d.id)}
                                  title={!canManageDocuments ? noPermissionTitle : t("common.delete")}
                                  type="button"
                                >
                                  <TrashIcon size={12} />
                                </button>
                              </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {instructorId && (
        <InstructorAssignmentFormModal
          branches={activeBranches}
          canManage={canManageTraining}
          editing={editing}
          instructorId={instructorId}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
          open={modalOpen}
        />
      )}

      {instructorId && docModalAssignmentId && (
        <AssignmentDocumentFormModal
          assignmentId={docModalAssignmentId}
          canManage={canManageDocuments}
          instructorId={instructorId}
          onClose={() => setDocModalAssignmentId(null)}
          onSaved={async () => {
            setDocModalAssignmentId(null);
            await refreshAssignments();
          }}
          open
        />
      )}

      <Modal
        footer={
          <>
            <button
              className="btn btn-secondary"
              disabled={leaveBusy}
              onClick={() => setLeaveModalOpen(false)}
              type="button"
            >
              İptal
            </button>
            <button
              className="btn btn-primary"
              disabled={leaveBusy || !leaveDate || !canManageTraining}
              onClick={submitLeave}
              title={!canManageTraining ? noPermissionTitle : undefined}
              type="button"
            >
              {leaveBusy ? t("common.saving") : t("common.save")}
            </button>
          </>
        }
        onClose={() => setLeaveModalOpen(false)}
        open={leaveModalOpen}
        title={t("instructor.detail.leaveModalTitle")}
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ayrılış Tarihi</label>
            <LocalizedDateInput
              ariaLabel={t("instructor.detail.leaveDateAria")}
              className="form-input"
              lang="tr"
              onChange={(value) => setLeaveDate(value)}
              value={leaveDate}
            />
          </div>
        </div>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Ayrılış Nedeni</label>
            <textarea
              className="form-input"
              maxLength={500}
              onChange={(event) => setLeaveReason(event.target.value)}
              placeholder={t("instructor.detail.leaveReasonPlaceholder")}
              rows={4}
              value={leaveReason}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="assignment-field">
      <span className="assignment-field-label">{label}</span>
      <span className="assignment-field-value">{value}</span>
    </div>
  );
}
