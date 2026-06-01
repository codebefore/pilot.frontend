import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { LocalizedDateInput } from "../components/ui/LocalizedDateInput";
import { Modal } from "../components/ui/Modal";
import { PageLoadError } from "../components/ui/PageLoadError";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import { canManageArea } from "../lib/permissions";
import { getVehicle } from "../lib/vehicles-api";
import { useT, currentLocale } from "../lib/i18n";
import {
  createVehicleDocument,
  deleteVehicleDocument,
  listVehicleDocuments,
  updateVehicleDocument,
} from "../lib/vehicle-documents-api";
import {
  VEHICLE_FUEL_LABELS,
  VEHICLE_OWNERSHIP_LABELS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_TRANSMISSION_LABELS,
  VEHICLE_TYPE_LABELS,
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

const DOCUMENT_TYPE_LABELS: Record<VehicleDocumentType, string> = {
  insurance: "Sigorta",
  inspection: "Muayene",
  casco: "Kasko",
};

const DOCUMENT_TYPES: VehicleDocumentType[] = ["insurance", "inspection", "casco"];

export function VehicleDetailPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const canManageDocuments = canManageArea(user, permissions, "documents");
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const queryClient = useQueryClient();

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
      ? "Araç bilgileri yüklenemedi"
      : null;

  const [modalType, setModalType] = useState<VehicleDocumentType | null>(null);
  const [modalEditing, setModalEditing] = useState<VehicleDocumentResponse | null>(null);
  const [modalStart, setModalStart] = useState("");
  const [modalEnd, setModalEnd] = useState("");
  const [modalNotes, setModalNotes] = useState("");
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
    await queryClient.invalidateQueries({ queryKey: ["vehicleDocuments", vehicleId] });
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
  };

  const openEdit = (doc: VehicleDocumentResponse) => {
    if (!canManageDocuments) return;
    setModalType(doc.documentType);
    setModalEditing(doc);
    setModalStart(doc.startDate.slice(0, 10));
    setModalEnd(doc.endDate.slice(0, 10));
    setModalNotes(doc.notes ?? "");
  };

  const closeModal = () => {
    setModalType(null);
    setModalEditing(null);
  };

  const submitModal = async () => {
    if (!canManageDocuments) return;
    if (!vehicleId || !modalType || !modalStart || !modalEnd) return;
    if (modalEnd < modalStart) {
      showToast("Bitiş tarihi başlangıçtan önce olamaz", "error");
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
          rowVersion: modalEditing.rowVersion,
        });
      } else {
        await createVehicleDocument(vehicleId, {
          documentType: modalType,
          startDate: modalStart,
          endDate: modalEnd,
          notes: modalNotes.trim() || null,
        });
      }
      showToast(modalEditing ? "Belge güncellendi" : "Belge eklendi");
      closeModal();
      await refreshDocuments();
    } catch {
      showToast("Belge kaydedilemedi", "error");
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
      showToast("Belge silindi");
      await refreshDocuments();
    } catch {
      showToast("Belge silinemedi", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="instructor-detail">
      <div className="instructor-detail-breadcrumb">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate("/settings/definitions/vehicles")}
          type="button"
        >
          ← Araç listesine dön
        </button>
      </div>

      {loading && (
        <div className="instructor-detail-card">
          <span className="skeleton" style={{ width: 240, height: 24 }} />
        </div>
      )}

      {!loading && error && (
        <PageLoadError
          title="Araç bilgileri yüklenemedi"
          description="Araç detayı şu anda yüklenemedi. Bağlantınızı kontrol edip tekrar deneyebilirsiniz."
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
              <div className="instructor-detail-code">{vehicle.plateNumber}</div>
              <h2 className="instructor-detail-name">
                {vehicle.brand}
                {vehicle.model ? ` ${vehicle.model}` : ""}
                {vehicle.modelYear ? ` (${vehicle.modelYear})` : ""}
              </h2>
              <div className="instructor-detail-meta">
                <span
                  className={`instructor-detail-status${vehicle.isActive ? " active" : " inactive"}`}
                >
                  {vehicle.isActive ? "Aktif" : "Pasif"}
                </span>
                <span>{VEHICLE_STATUS_LABELS[vehicle.status]}</span>
                {vehicle.color ? <span>{vehicle.color}</span> : null}
              </div>
            </div>

            <div className="instructor-detail-summary-grid">
              <Field label="Tür" value={VEHICLE_TYPE_LABELS[vehicle.vehicleType] ?? "—"} />
              <Field label="Ehliyet Tipleri" value={vehicle.licenseClasses.join(", ") || "—"} />
              <Field
                label="Vites"
                value={VEHICLE_TRANSMISSION_LABELS[vehicle.transmissionType] ?? "—"}
              />
              <Field
                label="Mülkiyet"
                value={VEHICLE_OWNERSHIP_LABELS[vehicle.ownershipType] ?? "—"}
              />
              <Field
                label="Yakıt"
                value={vehicle.fuelType ? VEHICLE_FUEL_LABELS[vehicle.fuelType] : "—"}
              />
              <Field
                label="Kilometre"
                value={formatOdometer(vehicle.odometerValue, vehicle.odometerUnit)}
              />
              <Field label="Tescil Tarihi" value={formatDate(vehicle.registrationDate)} />
              <Field label="Hizmete Giriş" value={formatDate(vehicle.serviceStartDate)} />
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
                  <h3>{DOCUMENT_TYPE_LABELS[type]}</h3>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!canManageDocuments}
                    onClick={() => openCreate(type)}
                    title={!canManageDocuments ? noPermissionTitle : undefined}
                    type="button"
                  >
                    Yeni {DOCUMENT_TYPE_LABELS[type]} Kaydı
                  </button>
                </div>

                {docs.length === 0 ? (
                  <div className="instructor-detail-empty">
                    Henüz {DOCUMENT_TYPE_LABELS[type].toLowerCase()} kaydı eklenmedi.
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
                                    {deletingId === doc.id ? "Siliniyor..." : "Sil"}
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
              disabled={modalBusy || !modalStart || !modalEnd || !canManageDocuments}
              onClick={submitModal}
              title={!canManageDocuments ? noPermissionTitle : undefined}
              type="button"
            >
              {modalBusy ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </>
        }
        onClose={closeModal}
        open={modalType !== null}
        title={
          modalType
            ? `${modalEditing ? "Düzenle" : "Yeni"} — ${DOCUMENT_TYPE_LABELS[modalType]}`
            : ""
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Başlangıç</label>
            <LocalizedDateInput
              ariaLabel="Başlangıç tarihi"
              className="form-input"
              lang="tr"
              onChange={(value) => setModalStart(value)}
              value={modalStart}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Bitiş</label>
            <LocalizedDateInput
              ariaLabel="Bitiş tarihi"
              className="form-input"
              lang="tr"
              onChange={(value) => setModalEnd(value)}
              value={modalEnd}
            />
          </div>
        </div>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Notlar</label>
            <textarea
              className="form-input"
              maxLength={500}
              onChange={(event) => setModalNotes(event.target.value)}
              placeholder="Poliçe no, sigorta şirketi vb."
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
