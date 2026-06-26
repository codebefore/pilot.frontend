import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { LocalizedDateInput } from "../components/ui/LocalizedDateInput";
import { Modal } from "../components/ui/Modal";
import { PageLoadError } from "../components/ui/PageLoadError";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import { canManageArea } from "../lib/permissions";
import { getVehicle } from "../lib/vehicles-api";
import { useT, currentLocale, type TranslationKey } from "../lib/i18n";
import {
  createVehicleDocument,
  deleteVehicleDocument,
  getVehicleDocumentDownloadUrl,
  listVehicleDocuments,
  updateVehicleDocument,
} from "../lib/vehicle-documents-api";
import { downloadAuthorizedFile } from "../lib/authorized-files";
import {
  VEHICLE_FUEL_LABEL_KEYS,
  VEHICLE_OWNERSHIP_LABEL_KEYS,
  VEHICLE_STATUS_LABEL_KEYS,
  VEHICLE_TRANSMISSION_LABEL_KEYS,
  VEHICLE_TYPE_LABEL_KEYS,
} from "../lib/vehicle-catalog";
import type {
  VehicleDocumentResponse,
  VehicleDocumentType,
} from "../lib/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function formatOdometer(value: number | null, unit: "km" | "hour"): string {
  if (value == null) return "—";
  const formatted = value.toLocaleString(currentLocale());
  return unit === "hour" ? `${formatted} sa` : `${formatted} km`;
}

const DOCUMENT_TYPE_LABEL_KEY: Record<VehicleDocumentType, TranslationKey> = {
  insurance: "vehicle.document.insurance",
  inspection: "vehicle.document.inspection",
  casco: "vehicle.document.casco",
};

const DOCUMENT_TYPES: VehicleDocumentType[] = ["insurance", "inspection", "casco"];

export function VehicleDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const canManageDocuments = canManageArea(user, permissions, "documents");
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const queryClient = useQueryClient();
  const returnState = location.state as { returnLabel?: string; returnTo?: string } | null;
  const breadcrumbLabel = returnState?.returnLabel ?? t("vehicle.detail.backToList");
  const breadcrumbTarget = returnState?.returnTo ?? "/settings/definitions/vehicles";

  const vehicleQuery = useQuery({
    queryKey: ["vehicles", "detail", vehicleId],
    queryFn: ({ signal }) => getVehicle(vehicleId as string, signal),
    enabled: Boolean(vehicleId),
  });
  const documentsQuery = useQuery({
    queryKey: ["vehicleDocuments", vehicleId],
    queryFn: ({ signal }) => listVehicleDocuments(vehicleId as string, signal),
    enabled: Boolean(vehicleId),
  });

  const vehicle = vehicleQuery.data ?? null;
  const documents = documentsQuery.data ?? [];
  const loading = vehicleQuery.isLoading || documentsQuery.isLoading;
  const error =
    vehicleQuery.isError || documentsQuery.isError
      ? t("vehicle.detail.loadFailed")
      : null;

  const [modalType, setModalType] = useState<VehicleDocumentType | null>(null);
  const [modalEditing, setModalEditing] = useState<VehicleDocumentResponse | null>(null);
  const [modalStart, setModalStart] = useState("");
  const [modalEnd, setModalEnd] = useState("");
  const [modalNotes, setModalNotes] = useState("");
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [modalBusy, setModalBusy] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const groupedDocs = useMemo(() => {
    const map: Record<VehicleDocumentType, VehicleDocumentResponse[]> = {
      insurance: [],
      inspection: [],
      casco: [],
    };
    for (const doc of documents) {
      map[doc.documentType].push(doc);
    }
    return map;
  }, [documents]);

  const refreshDocuments = async () => {
    if (!vehicleId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vehicleDocuments", vehicleId] }),
      queryClient.invalidateQueries({ queryKey: ["vehicles", "list"] }),
      queryClient.invalidateQueries({ queryKey: ["vehicles", "detail"] }),
      queryClient.invalidateQueries({ queryKey: ["vehicles", "detail", vehicleId] }),
      queryClient.invalidateQueries({ queryKey: ["training", "vehicles"] }),
      queryClient.invalidateQueries({ queryKey: ["training", "lessons"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications", "list"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const openCreate = (type: VehicleDocumentType) => {
    if (!canManageDocuments) return;
    setModalType(type);
    setModalEditing(null);
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setModalStart(iso);
    setModalEnd("");
    setModalNotes("");
    setModalFile(null);
  };

  const openEdit = (doc: VehicleDocumentResponse) => {
    if (!canManageDocuments) return;
    setModalType(doc.documentType);
    setModalEditing(doc);
    setModalStart(doc.startDate.slice(0, 10));
    setModalEnd(doc.endDate.slice(0, 10));
    setModalNotes(doc.notes ?? "");
    setModalFile(null);
  };

  const closeModal = () => {
    setModalType(null);
    setModalEditing(null);
    setModalFile(null);
  };

  const submitModal = async () => {
    if (!canManageDocuments) return;
    if (!vehicleId || !modalType || !modalStart || !modalEnd) return;
    if (!modalEditing && !modalFile) {
      showToast("Dosya seçin.", "error");
      return;
    }
    if (modalEnd < modalStart) {
      showToast(t("vehicle.detail.toast.endBeforeStart"), "error");
      return;
    }
    setModalBusy(true);
    try {
      if (modalEditing) {
        await updateVehicleDocument(vehicleId, modalEditing.id, {
          documentType: modalType,
          startDate: modalStart,
          endDate: modalEnd,
          notes: modalNotes.trim() || null,
          file: modalFile,
          rowVersion: modalEditing.rowVersion,
        });
      } else {
        await createVehicleDocument(vehicleId, {
          documentType: modalType,
          startDate: modalStart,
          endDate: modalEnd,
          notes: modalNotes.trim() || null,
          file: modalFile,
        });
      }
      showToast(modalEditing ? t("vehicle.detail.toast.docUpdated") : t("vehicle.detail.toast.docCreated"));
      closeModal();
      await refreshDocuments();
    } catch {
      showToast(t("vehicle.detail.toast.docSaveFailed"), "error");
    } finally {
      setModalBusy(false);
    }
  };

  const handleDelete = async (doc: VehicleDocumentResponse) => {
    if (!canManageDocuments) return;
    if (!vehicleId) return;
    setDeletingId(doc.id);
    try {
      await deleteVehicleDocument(vehicleId, doc.id, doc.rowVersion);
      setConfirmDeleteId(null);
      showToast(t("vehicle.detail.toast.docDeleted"));
      await refreshDocuments();
    } catch {
      showToast(t("vehicle.detail.toast.docDeleteFailed"), "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="instructor-detail">
      <div className="instructor-detail-breadcrumb">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate(breadcrumbTarget)}
          type="button"
        >
          {breadcrumbLabel}
        </button>
      </div>

      {loading && (
        <div className="instructor-detail-card">
          <span className="skeleton" style={{ width: 240, height: 24 }} />
        </div>
      )}

      {!loading && error && (
        <PageLoadError
          title={t("vehicle.detail.loadFailed")}
          description={t("vehicle.detail.loadFailedDescription")}
          onRetry={() => {
            void vehicleQuery.refetch();
            void documentsQuery.refetch();
          }}
        />
      )}

      {!loading && !error && vehicle && (
        <>
          <header className="instructor-detail-card instructor-detail-header">
            <div className="instructor-detail-header-main">
              <div className="instructor-detail-code">
                {vehicle.plateNumber || (vehicle.isSimulator ? t("vehicleForm.field.simulator") : "—")}
              </div>
              <h2 className="instructor-detail-name">
                {vehicle.brand || (vehicle.isSimulator ? t("vehicleForm.field.simulator") : "—")}
                {vehicle.model ? ` ${vehicle.model}` : ""}
                {vehicle.modelYear ? ` (${vehicle.modelYear})` : ""}
              </h2>
              <div className="instructor-detail-meta">
                <span
                  className={`instructor-detail-status${vehicle.isActive ? " active" : " inactive"}`}
                >
                  {vehicle.isActive ? t("common.statusActive") : t("common.statusInactive")}
                </span>
                <span>{t(VEHICLE_STATUS_LABEL_KEYS[vehicle.status])}</span>
                {vehicle.color ? <span>{vehicle.color}</span> : null}
              </div>
            </div>

            <div className="instructor-detail-summary-grid">
              <Field label={t("vehicle.detail.field.type")} value={VEHICLE_TYPE_LABEL_KEYS[vehicle.vehicleType] ? t(VEHICLE_TYPE_LABEL_KEYS[vehicle.vehicleType]) : "—"} />
              <Field
                label={t("common.field.licenseClasses")}
                value={vehicle.isSimulator ? t("common.all") : vehicle.licenseClasses.join(", ") || "—"}
              />
              <Field
                label={t("vehicleForm.field.transmission")}
                value={VEHICLE_TRANSMISSION_LABEL_KEYS[vehicle.transmissionType] ? t(VEHICLE_TRANSMISSION_LABEL_KEYS[vehicle.transmissionType]) : "—"}
              />
              <Field
                label={t("vehicle.detail.field.ownership")}
                value={VEHICLE_OWNERSHIP_LABEL_KEYS[vehicle.ownershipType] ? t(VEHICLE_OWNERSHIP_LABEL_KEYS[vehicle.ownershipType]) : "—"}
              />
              <Field
                label={t("vehicleForm.field.fuel")}
                value={vehicle.fuelType && VEHICLE_FUEL_LABEL_KEYS[vehicle.fuelType] ? t(VEHICLE_FUEL_LABEL_KEYS[vehicle.fuelType]) : "—"}
              />
              <Field
                label={t("vehicle.detail.field.mileage")}
                value={formatOdometer(vehicle.odometerValue, vehicle.odometerUnit)}
              />
              <Field label={t("vehicleForm.field.registrationDate")} value={formatDate(vehicle.registrationDate)} />
              <Field label={t("vehicle.detail.field.serviceStart")} value={formatDate(vehicle.serviceStartDate)} />
            </div>

            {vehicle.accidentNotes ? (
              <div className="instructor-detail-notes">
                <span className="instructor-detail-notes-label">Hasar Notları</span>
                <p>{vehicle.accidentNotes}</p>
              </div>
            ) : null}

            {vehicle.otherDetails ? (
              <div className="instructor-detail-notes">
                <span className="instructor-detail-notes-label">Diğer Bilgiler</span>
                <p>{vehicle.otherDetails}</p>
              </div>
            ) : null}

            {vehicle.notes ? (
              <div className="instructor-detail-notes">
                <span className="instructor-detail-notes-label">Notlar</span>
                <p>{vehicle.notes}</p>
              </div>
            ) : null}
          </header>

          {DOCUMENT_TYPES.map((type) => {
            const docs = groupedDocs[type];
            const latestId = docs[0]?.id ?? null;
            return (
              <section className="instructor-detail-card" key={type}>
                <div className="assignment-list-header">
                  <h3>{t(DOCUMENT_TYPE_LABEL_KEY[type])}</h3>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!canManageDocuments}
                    onClick={() => openCreate(type)}
                    title={!canManageDocuments ? noPermissionTitle : undefined}
                    type="button"
                  >
                    {t("vehicle.detail.newCardTitle", { type: t(DOCUMENT_TYPE_LABEL_KEY[type]) })}
                  </button>
                </div>

                {docs.length === 0 ? (
                  <div className="instructor-detail-empty">
                    {t("vehicle.detail.emptyDocs", { type: t(DOCUMENT_TYPE_LABEL_KEY[type]).toLowerCase() })}
                  </div>
                ) : (
                  <ul className="assignment-list">
                    {docs.map((doc) => {
                      const isActive = doc.id === latestId;
                      const isConfirming = confirmDeleteId === doc.id;
                      return (
                        <li
                          className={`assignment-item${isActive ? " assignment-item-active" : ""}`}
                          key={doc.id}
                        >
                          <div className="assignment-item-head">
                            <div className="assignment-item-title">
                              {formatDate(doc.startDate)} — {formatDate(doc.endDate)}
                            </div>
                            {isActive ? (
                              <span className="assignment-item-badge">Aktif</span>
                            ) : (
                              <span className="assignment-item-badge assignment-item-badge-inactive">
                                Pasif
                              </span>
                            )}
                            <div className="assignment-item-actions">
                              {isConfirming ? (
                                <>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={deletingId === doc.id}
                                    onClick={() => setConfirmDeleteId(null)}
                                    type="button"
                                  >
                                    İptal
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    disabled={deletingId === doc.id || !canManageDocuments}
                                    onClick={() => handleDelete(doc)}
                                    title={!canManageDocuments ? noPermissionTitle : undefined}
                                    type="button"
                                  >
                                    {deletingId === doc.id ? t("common.deleting") : t("common.delete")}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={!canManageDocuments}
                                    onClick={() => openEdit(doc)}
                                    title={!canManageDocuments ? noPermissionTitle : undefined}
                                    type="button"
                                  >
                                    Düzenle
                                  </button>
                                  {doc.hasFile ? (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => {
                                        void downloadAuthorizedFile(
                                          getVehicleDocumentDownloadUrl(vehicle.id, doc.id),
                                          doc.originalFileName
                                        );
                                      }}
                                      type="button"
                                    >
                                      Dosya
                                    </button>
                                  ) : null}
                                  <button
                                    className="btn btn-link btn-sm btn-link-danger"
                                    disabled={!canManageDocuments}
                                    onClick={() => {
                                      if (!canManageDocuments) return;
                                      setConfirmDeleteId(doc.id);
                                    }}
                                    title={!canManageDocuments ? noPermissionTitle : undefined}
                                    type="button"
                                  >
                                    Sil
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {doc.notes ? (
                            <div className="assignment-item-notes">{doc.notes}</div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </>
      )}

      <Modal
        footer={
          <>
            <button
              className="btn btn-secondary"
              disabled={modalBusy}
              onClick={closeModal}
              type="button"
            >
              İptal
            </button>
            <button
              className="btn btn-primary"
              disabled={
                modalBusy ||
                !modalStart ||
                !modalEnd ||
                (!modalEditing && !modalFile) ||
                !canManageDocuments
              }
              onClick={submitModal}
              title={!canManageDocuments ? noPermissionTitle : undefined}
              type="button"
            >
              {modalBusy ? t("common.saving") : t("common.save")}
            </button>
          </>
        }
        onClose={closeModal}
        open={modalType !== null}
        title={
          modalType
            ? `${modalEditing ? t("common.edit") : t("common.new")} — ${t(DOCUMENT_TYPE_LABEL_KEY[modalType])}`
            : ""
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Başlangıç</label>
            <LocalizedDateInput
              ariaLabel={t("vehicle.detail.startDate")}
              className="form-input"
              lang="tr"
              onChange={(value) => setModalStart(value)}
              value={modalStart}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t("vehicle.detail.endDateLabel")}</label>
            <LocalizedDateInput
              ariaLabel={t("vehicle.detail.endDate")}
              className="form-input"
              lang="tr"
              onChange={(value) => setModalEnd(value)}
              value={modalEnd}
            />
          </div>
        </div>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Dosya</label>
            <input
              accept="application/pdf,image/jpeg,image/png"
              className="form-input"
              onChange={(event) => setModalFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            <div className="form-hint">
              PDF, JPG veya PNG yukleyin. Sistem JPEG olarak kaydeder.
            </div>
          </div>
        </div>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Notlar</label>
            <textarea
              className="form-input"
              maxLength={500}
              onChange={(event) => setModalNotes(event.target.value)}
              placeholder={t("vehicle.detail.notePlaceholder")}
              rows={3}
              value={modalNotes}
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
