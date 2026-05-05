import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { PencilIcon, PlusIcon, TrashIcon } from "../components/icons";
import { AssignmentDocumentFormModal } from "../components/modals/AssignmentDocumentFormModal";
import { InstructorAssignmentFormModal } from "../components/modals/InstructorAssignmentFormModal";
import { useToast } from "../components/ui/Toast";
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
import { getInstructor } from "../lib/instructors-api";
import { getTrainingBranchDefinitions } from "../lib/training-branch-definitions-api";
import { useT } from "../lib/i18n";
import type {
  InstructorAssignment,
  InstructorResponse,
  TrainingBranchDefinitionResponse,
} from "../lib/types";

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
  const { instructorId } = useParams<{ instructorId: string }>();
  const [instructor, setInstructor] = useState<InstructorResponse | null>(null);
  const [assignments, setAssignments] = useState<InstructorAssignment[]>([]);
  const [branches, setBranches] = useState<TrainingBranchDefinitionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InstructorAssignment | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [docModalAssignmentId, setDocModalAssignmentId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  useEffect(() => {
    if (!instructorId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      getInstructor(instructorId, controller.signal),
      listAssignments(instructorId),
      getTrainingBranchDefinitions(
        { activity: "all", page: 1, pageSize: 100 },
        controller.signal
      ),
    ])
      .then(([instructorData, assignmentList, branchData]) => {
        setInstructor(instructorData);
        setAssignments(assignmentList);
        setBranches(branchData.items);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(t("settings.instructors.errors.loadFailed"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [instructorId, t]);

  const branchLabelMap = useMemo(() => {
    return branches.reduce<Record<string, string>>((acc, b) => {
      acc[b.code] = b.name;
      return acc;
    }, {});
  }, [branches]);
  const activeBranches = useMemo(() => branches.filter((branch) => branch.isActive), [branches]);

  const activeAssignmentId = assignments[0]?.id ?? null;

  const refreshAssignments = async () => {
    if (!instructorId) return;
    const list = await listAssignments(instructorId);
    setAssignments(list);
  };

  const handleSaved = async () => {
    setModalOpen(false);
    setEditing(null);
    await refreshAssignments();
  };

  const handleDocumentDelete = async (assignmentId: string, documentId: string) => {
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
            <div className="instructor-detail-header-main">
              <div className="instructor-detail-code">{instructor.code}</div>
              <h2 className="instructor-detail-name">
                {instructor.firstName} {instructor.lastName}
              </h2>
              <div className="instructor-detail-meta">
                <span
                  className={`instructor-detail-status${instructor.isActive ? " active" : " inactive"}`}
                >
                  {instructor.isActive ? "Aktif" : "Pasif"}
                </span>
                {instructor.phoneNumber ? <span>{instructor.phoneNumber}</span> : null}
                {instructor.email ? <span>{instructor.email}</span> : null}
              </div>
            </div>

            <div className="instructor-detail-summary-grid">
              <Field label="TC Kimlik No" value={instructor.nationalId ?? "—"} />
              <Field
                label="Görev"
                value={INSTRUCTOR_ROLE_LABELS[instructor.role] ?? "—"}
              />
              <Field
                label="Statü"
                value={INSTRUCTOR_EMPLOYMENT_LABELS[instructor.employmentType] ?? "—"}
              />
              <Field
                label="Branş"
                value={
                  instructor.branches.length > 0
                    ? instructor.branches
                        .map((b) => branchLabelMap[b] ?? b)
                        .join(", ")
                    : "—"
                }
              />
              <Field
                label="Haftalık Ders Saati"
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
                label="Toplam Atama"
                value={String(assignments.length)}
              />
              <Field
                label="Kayıt Tarihi"
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
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
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
                        {isActive && (
                          <span className="assignment-item-badge">
                            {t("settings.instructors.detail.assignments.active")}
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
                                disabled={deletingId === a.id}
                                onClick={() => handleDelete(a)}
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
                                  onClick={() => {
                                    setEditing(a);
                                    setModalOpen(true);
                                  }}
                                  title={t("common.edit")}
                                  type="button"
                                >
                                  <PencilIcon size={14} />
                                </button>
                              ) : null}
                              <button
                                aria-label={t("common.delete")}
                                className="icon-btn icon-btn-danger"
                                disabled={deletingId !== null}
                                onClick={() => setConfirmDeleteId(a.id)}
                                title={t("common.delete")}
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
                              onClick={() => setDocModalAssignmentId(a.id)}
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
                                  disabled={deletingDocId === d.id}
                                  onClick={() => handleDocumentDelete(a.id, d.id)}
                                  title={t("common.delete")}
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
          instructorId={instructorId}
          onClose={() => setDocModalAssignmentId(null)}
          onSaved={async () => {
            setDocModalAssignmentId(null);
            await refreshAssignments();
          }}
          open
        />
      )}
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
