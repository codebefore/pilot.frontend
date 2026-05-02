import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useToast } from "../components/ui/Toast";
import { LICENSE_CLASS_DEFINITION_CATEGORY_LABELS } from "../lib/license-class-definition-catalog";
import { getLicenseClassDefinition } from "../lib/license-class-definitions-api";
import type { LicenseClassDefinitionResponse } from "../lib/types";

function formatBool(value: boolean): string {
  return value ? "Evet" : "Hayır";
}

function formatHours(value: number | null): string {
  return value != null ? `${value} sa` : "—";
}

export function LicenseClassDefinitionDetailPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { definitionId } = useParams<{ definitionId: string }>();
  const [definition, setDefinition] = useState<LicenseClassDefinitionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!definitionId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getLicenseClassDefinition(definitionId, controller.signal)
      .then((data) => setDefinition(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Ehliyet tipi bilgileri yüklenemedi");
        showToast("Ehliyet tipi bilgileri yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [definitionId, showToast]);

  return (
    <div className="instructor-detail">
      <div className="instructor-detail-breadcrumb">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate("/settings/definitions/license-classes")}
          type="button"
        >
          ← Ehliyet tipleri listesine dön
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

      {!loading && !error && definition && (
        <header className="instructor-detail-card instructor-detail-header">
          <div className="instructor-detail-header-main">
            <div className="instructor-detail-code">{definition.code}</div>
            <h2 className="instructor-detail-name">{definition.name}</h2>
            <div className="instructor-detail-meta">
              <span
                className={`instructor-detail-status${definition.isActive ? " active" : " inactive"}`}
              >
                {definition.isActive ? "Aktif" : "Pasif"}
              </span>
              <span>
                {LICENSE_CLASS_DEFINITION_CATEGORY_LABELS[definition.category] ?? definition.category}
              </span>
            </div>
          </div>

          <div className="instructor-detail-summary-grid">
            <Field
              label="Minimum Yaş"
              value={definition.minimumAge != null ? String(definition.minimumAge) : "—"}
            />
            <Field label="Görüntü Sırası" value={String(definition.displayOrder)} />
            <Field label="Mevcut Ehliyet Şartı" value={formatBool(definition.hasExistingLicense)} />
            <Field label="Mevcut Ehliyet Tipi" value={definition.existingLicenseType ?? "—"} />
            <Field
              label="2016 Öncesi Ehliyet"
              value={formatBool(definition.existingLicensePre2016)}
            />
          </div>

          <div className="instructor-detail-summary-grid">
            <Field label="Teorik Sınav" value={formatBool(definition.requiresTheoryExam)} />
            <Field label="Uygulama Sınavı" value={formatBool(definition.requiresPracticeExam)} />
            <Field label="Teorik Ders Saati" value={formatHours(definition.theoryLessonHours)} />
            <Field
              label="Simülatör Ders Saati"
              value={formatHours(definition.simulatorLessonHours)}
            />
            <Field
              label="Direkt Uygulama Saati"
              value={formatHours(definition.directPracticeLessonHours)}
            />
          </div>

          {definition.notes ? (
            <div className="instructor-detail-notes">
              <span className="instructor-detail-notes-label">Notlar</span>
              <p>{definition.notes}</p>
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
