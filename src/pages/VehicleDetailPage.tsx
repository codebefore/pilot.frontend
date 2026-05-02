import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useToast } from "../components/ui/Toast";
import { getVehicle } from "../lib/vehicles-api";
import {
  VEHICLE_FUEL_LABELS,
  VEHICLE_OWNERSHIP_LABELS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_TRANSMISSION_LABELS,
  VEHICLE_TYPE_LABELS,
} from "../lib/vehicle-catalog";
import type { VehicleResponse } from "../lib/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function formatOdometer(value: number | null, unit: "km" | "hour"): string {
  if (value == null) return "—";
  const formatted = value.toLocaleString("tr-TR");
  return unit === "hour" ? `${formatted} sa` : `${formatted} km`;
}

export function VehicleDetailPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [vehicle, setVehicle] = useState<VehicleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicleId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getVehicle(vehicleId, controller.signal)
      .then((data) => setVehicle(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Araç bilgileri yüklenemedi");
        showToast("Araç bilgileri yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [showToast, vehicleId]);

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
        <div className="instructor-detail-card instructor-detail-error">{error}</div>
      )}

      {!loading && !error && vehicle && (
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
            <Field label="Ehliyet Tipi" value={vehicle.licenseClass} />
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
          </div>

          <div className="instructor-detail-summary-grid">
            <Field
              label="Sigorta Başlangıç"
              value={formatDate(vehicle.insuranceStartDate)}
            />
            <Field
              label="Sigorta Bitiş"
              value={formatDate(vehicle.insuranceEndDate)}
            />
            <Field
              label="Muayene Başlangıç"
              value={formatDate(vehicle.inspectionStartDate)}
            />
            <Field
              label="Muayene Bitiş"
              value={formatDate(vehicle.inspectionEndDate)}
            />
            <Field
              label="Kasko Başlangıç"
              value={formatDate(vehicle.cascoStartDate)}
            />
            <Field label="Kasko Bitiş" value={formatDate(vehicle.cascoEndDate)} />
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
