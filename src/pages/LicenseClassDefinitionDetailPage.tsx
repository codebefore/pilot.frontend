import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { PageLoadError } from "../components/ui/PageLoadError";
import { useT, type TranslationKey } from "../lib/i18n";
import { LICENSE_CLASS_DEFINITION_CATEGORY_LABELS } from "../lib/license-class-definition-catalog";
import { getLicenseClassDefinition } from "../lib/license-class-definitions-api";

function formatBool(value: boolean, t: (key: TranslationKey) => string): string {
  return value ? t("common.yes") : t("common.no");
}

function formatHours(value: number | null): string {
  return value != null ? `${value} sa` : "—";
}

export function LicenseClassDefinitionDetailPage() {
  const navigate = useNavigate();
  const t = useT();
  const { definitionId } = useParams<{ definitionId: string }>();

  const definitionQuery = useQuery({
    queryKey: ["licenseClassDefinitions", "detail", definitionId],
    queryFn: ({ signal }) => getLicenseClassDefinition(definitionId as string, signal),
    enabled: Boolean(definitionId),
  });
  const definition = definitionQuery.data ?? null;
  const loading = definitionQuery.isLoading;
  const error = definitionQuery.isError ? t("licenseClassDefinitionDetail.error.loadTitle") : null;

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
        <PageLoadError
          title={t("licenseClassDefinitionDetail.error.loadTitle")}
          description={t("licenseClassDefinitionDetail.error.loadDescription")}
          onRetry={() => void definitionQuery.refetch()}
        />
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
              label={t("licenseClassDefinitionDetail.field.minimumAge")}
              value={definition.minimumAge != null ? String(definition.minimumAge) : "—"}
            />
            <Field label={t("licenseClassDefinitionDetail.field.displayOrder")} value={String(definition.displayOrder)} />
            <Field label={t("licenseClassDefinitionDetail.field.existingLicenseRequired")} value={formatBool(definition.hasExistingLicense, t)} />
            <Field label="Mevcut Ehliyet Tipi" value={definition.existingLicenseType ?? "—"} />
            <Field
              label={t("licenseClassDefinitionDetail.field.pre2016License")}
              value={formatBool(definition.existingLicensePre2016, t)}
            />
          </div>

          <div className="instructor-detail-summary-grid">
            <Field label={t("licenseClassDefinitionDetail.field.theoryExam")} value={formatBool(definition.requiresTheoryExam, t)} />
            <Field label={t("licenseClassDefinitionDetail.field.practiceExam")} value={formatBool(definition.requiresPracticeExam, t)} />
            <Field label="Teorik Ders Saati" value={formatHours(definition.theoryLessonHours)} />
            <Field
              label={t("licenseClassDefinitionDetail.field.simulatorHours")}
              value={formatHours(definition.simulatorLessonHours)}
            />
            <Field
              label="Direkt Direksiyon Saati"
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
