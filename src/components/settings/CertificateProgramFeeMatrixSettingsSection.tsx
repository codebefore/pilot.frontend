import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  bulkApplyCertificateProgramFeeMatrix,
  getCertificateProgramFeeMatrix,
  updateCertificateProgramFeeMatrix,
} from "../../lib/certificate-program-fee-matrix-api";
import type {
  CertificateProgramFeeBulkApplyRequest,
  CertificateProgramFeeRowResponse,
  CertificateProgramFeeRowUpsertRequest,
} from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { useToast } from "../ui/Toast";

type EditableField = keyof Pick<
  CertificateProgramFeeRowResponse,
  | "vatIncludedHourlyRate"
  | "contractTheoryExamFee"
  | "contractPracticeExamFee"
  | "institutionEducationFee"
  | "institutionMebbisEducationFee"
  | "institutionTheoryExamFee"
  | "institutionPracticeExamFee"
  | "institutionRepeatPracticeExamFee"
  | "privateLessonFee"
  | "otherFee"
>;

const EDITABLE_FIELDS: { value: EditableField; label: string }[] = [
  { value: "vatIncludedHourlyRate", label: "Saat Ücreti (KDV'li)" },
  { value: "contractTheoryExamFee", label: "Sözleşme Teorik Sınav" },
  { value: "contractPracticeExamFee", label: "Sözleşme Direksiyon Sınav" },
  { value: "institutionEducationFee", label: "Eğitim Ücreti" },
  { value: "institutionMebbisEducationFee", label: "Eğitim Ücreti MEBBİS" },
  { value: "institutionTheoryExamFee", label: "Teorik Sınav Ücreti" },
  { value: "institutionPracticeExamFee", label: "Direksiyon Sınav Ücreti" },
  { value: "institutionRepeatPracticeExamFee", label: "2-3-4 Hak Ücreti" },
  { value: "privateLessonFee", label: "Özel Ders Ücreti" },
  { value: "otherFee", label: "Diğer" },
];

const BACKEND_FIELD_BY_EDITABLE_FIELD: Record<EditableField, string> = {
  vatIncludedHourlyRate: "VatIncludedHourlyRate",
  contractTheoryExamFee: "ContractTheoryExamFee",
  contractPracticeExamFee: "ContractPracticeExamFee",
  institutionEducationFee: "InstitutionEducationFee",
  institutionMebbisEducationFee: "InstitutionMebbisEducationFee",
  institutionTheoryExamFee: "InstitutionTheoryExamFee",
  institutionPracticeExamFee: "InstitutionPracticeExamFee",
  institutionRepeatPracticeExamFee: "InstitutionRepeatPracticeExamFee",
  privateLessonFee: "PrivateLessonFee",
  otherFee: "OtherFee",
};

const BULK_FIELD_LESSON_SCOPE: Partial<Record<EditableField, "theory" | "practice">> = {
  contractTheoryExamFee: "theory",
  institutionTheoryExamFee: "theory",
  contractPracticeExamFee: "practice",
  institutionPracticeExamFee: "practice",
  institutionRepeatPracticeExamFee: "practice",
};

function getFieldLessonScope(field: EditableField): "theory" | "practice" | null {
  return BULK_FIELD_LESSON_SCOPE[field] ?? null;
}

const CURRENT_YEAR = new Date().getFullYear();
const VAT_RATE = 0.1;

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseAmount(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function serializeAmount(value: number | null): string {
  return value == null ? "" : String(value);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateVatExcludedHourlyRate(row: CertificateProgramFeeRowResponse): number | null {
  return row.vatIncludedHourlyRate == null
    ? null
    : roundMoney(row.vatIncludedHourlyRate / (1 + VAT_RATE));
}

function calculateLessonFee(row: CertificateProgramFeeRowResponse): number | null {
  return row.vatIncludedHourlyRate == null
    ? null
    : roundMoney(row.vatIncludedHourlyRate * row.lessonHours);
}

function calculateVatAmount(row: CertificateProgramFeeRowResponse): number | null {
  const vatExcludedHourlyRate = calculateVatExcludedHourlyRate(row);
  return row.vatIncludedHourlyRate == null || vatExcludedHourlyRate == null
    ? null
    : roundMoney((row.vatIncludedHourlyRate - vatExcludedHourlyRate) * row.lessonHours);
}

function calculateContractTotal(row: CertificateProgramFeeRowResponse): number | null {
  const lessonFee = calculateLessonFee(row);
  return lessonFee == null
    ? null
    : roundMoney(
        lessonFee +
          (row.contractTheoryExamFee ?? 0) +
          (row.contractPracticeExamFee ?? 0)
      );
}

function calculateRowTotal(row: CertificateProgramFeeRowResponse): number | null {
  const lessonFee = calculateLessonFee(row);
  const manualTotal =
    (row.contractTheoryExamFee ?? 0) +
    (row.contractPracticeExamFee ?? 0) +
    (row.institutionEducationFee ?? 0) +
    (row.institutionMebbisEducationFee ?? 0) +
    (row.institutionTheoryExamFee ?? 0) +
    (row.institutionPracticeExamFee ?? 0) +
    (row.institutionRepeatPracticeExamFee ?? 0) +
    (row.privateLessonFee ?? 0) +
    (row.otherFee ?? 0);

  return lessonFee == null && manualTotal === 0 ? null : roundMoney((lessonFee ?? 0) + manualTotal);
}

function calculateProgramTotal(
  rows: CertificateProgramFeeRowResponse[],
  programId: string
): number | null {
  let total = 0;
  let hasValue = false;

  for (const row of rows) {
    if (row.program.id !== programId) continue;

    const rowTotal = calculateRowTotal(row);
    if (rowTotal == null) continue;

    total += rowTotal;
    hasValue = true;
  }

  return hasValue ? roundMoney(total) : null;
}

function rowKey(row: CertificateProgramFeeRowResponse): string {
  return `${row.program.id}:${row.lessonType}`;
}

function hasEditableValue(row: CertificateProgramFeeRowResponse): boolean {
  return EDITABLE_FIELDS.some((field) => row[field.value] != null);
}

function toUpsertRow(row: CertificateProgramFeeRowResponse): CertificateProgramFeeRowUpsertRequest {
  const isTheory = row.lessonType === "theory";
  return {
    certificateProgramId: row.program.id,
    lessonType: row.lessonType,
    vatIncludedHourlyRate: row.vatIncludedHourlyRate,
    contractTheoryExamFee: isTheory ? row.contractTheoryExamFee : null,
    contractPracticeExamFee: isTheory ? null : row.contractPracticeExamFee,
    institutionEducationFee: row.institutionEducationFee,
    institutionMebbisEducationFee: row.institutionMebbisEducationFee,
    institutionTheoryExamFee: isTheory ? row.institutionTheoryExamFee : null,
    institutionPracticeExamFee: isTheory ? null : row.institutionPracticeExamFee,
    institutionRepeatPracticeExamFee: isTheory ? null : row.institutionRepeatPracticeExamFee,
    privateLessonFee: row.privateLessonFee,
    otherFee: row.otherFee,
    rowVersion: row.rowVersion,
  };
}

type ColumnKind = "info" | "calculated" | "editable";
type Column = {
  key: string;
  label: string;
  kind: ColumnKind;
  editableField?: EditableField;
  /** The cell renderer for non-editable columns. */
  render?: (
    row: CertificateProgramFeeRowResponse,
    rows: CertificateProgramFeeRowResponse[]
  ) => React.ReactNode;
  /** Optional minimum cell width (px) to give the column some breathing room. */
  width?: number;
  /** When true, column header + cells stick to the left while scrolling. */
  sticky?: boolean;
};

function renderSourceLicense(row: CertificateProgramFeeRowResponse): React.ReactNode {
  return (
    <span
      className="fee-matrix-license-cell"
      title={`${row.program.sourceLicenseDisplayName}${
        row.program.sourceLicensePre2016 ? " (2016 öncesi)" : ""
      } -> ${row.program.targetLicenseDisplayName}`}
    >
      <span className="fee-matrix-license-name">{row.program.sourceLicenseDisplayName}</span>
      {row.program.sourceLicensePre2016 ? (
        <span className="fee-matrix-period-badge">2016</span>
      ) : null}
    </span>
  );
}

function compareLessonType(
  a: CertificateProgramFeeRowResponse,
  b: CertificateProgramFeeRowResponse
): number {
  const order = { theory: 0, practice: 1 };
  return order[a.lessonType] - order[b.lessonType];
}

function isMergedProgramColumn(column: Column): boolean {
  return column.key === "source" || column.key === "target" || column.key === "programTotal";
}

function isFirstProgramRow(
  rows: CertificateProgramFeeRowResponse[],
  row: CertificateProgramFeeRowResponse,
  index: number
): boolean {
  return index === 0 || rows[index - 1].program.id !== row.program.id;
}

function countProgramRows(
  rows: CertificateProgramFeeRowResponse[],
  programId: string
): number {
  return rows.filter((row) => row.program.id === programId).length;
}

const COLUMNS: Column[] = [
  {
    key: "source",
    label: "Mevcut",
    kind: "info",
    sticky: true,
    width: 110,
    render: renderSourceLicense,
  },
  {
    key: "target",
    label: "İstenen",
    kind: "info",
    sticky: true,
    width: 76,
    render: (row) => (
      <span className="fee-matrix-target-name">{row.program.targetLicenseDisplayName}</span>
    ),
  },
  {
    key: "lessonType",
    label: "Ders",
    kind: "info",
    sticky: true,
    width: 70,
    render: (row) => (row.lessonType === "theory" ? "Teorik" : "Direksiyon"),
  },
  {
    key: "lessonHours",
    label: "Saat",
    kind: "info",
    width: 56,
    render: (row) => row.lessonHours,
  },
  {
    key: "vatIncludedHourlyRate",
    label: "Saat KDV'li",
    kind: "editable",
    editableField: "vatIncludedHourlyRate",
    width: 92,
  },
  {
    key: "vatExcludedHourlyRate",
    label: "Saat KDV'siz",
    kind: "calculated",
    width: 80,
    render: (row) => formatMoney(calculateVatExcludedHourlyRate(row)),
  },
  {
    key: "lessonFee",
    label: "Ders Ücreti",
    kind: "calculated",
    width: 84,
    render: (row) => formatMoney(calculateLessonFee(row)),
  },
  {
    key: "vatAmount",
    label: "KDV",
    kind: "calculated",
    width: 72,
    render: (row) => formatMoney(calculateVatAmount(row)),
  },
  {
    key: "contractTotal",
    label: "Sözleşme Toplam",
    kind: "calculated",
    width: 96,
    render: (row) => formatMoney(calculateContractTotal(row)),
  },
  {
    key: "contractTheoryExamFee",
    label: "Söz. Teorik",
    kind: "editable",
    editableField: "contractTheoryExamFee",
    width: 76,
  },
  {
    key: "contractPracticeExamFee",
    label: "Söz. Direksiyon",
    kind: "editable",
    editableField: "contractPracticeExamFee",
    width: 84,
  },
  {
    key: "institutionEducationFee",
    label: "Eğitim",
    kind: "editable",
    editableField: "institutionEducationFee",
    width: 92,
  },
  {
    key: "institutionMebbisEducationFee",
    label: "MEBBİS",
    kind: "editable",
    editableField: "institutionMebbisEducationFee",
    width: 92,
  },
  {
    key: "institutionTheoryExamFee",
    label: "Teorik Sınav",
    kind: "editable",
    editableField: "institutionTheoryExamFee",
    width: 80,
  },
  {
    key: "institutionPracticeExamFee",
    label: "Direksiyon Sınav",
    kind: "editable",
    editableField: "institutionPracticeExamFee",
    width: 84,
  },
  {
    key: "institutionRepeatPracticeExamFee",
    label: "2-3-4 Hak",
    kind: "editable",
    editableField: "institutionRepeatPracticeExamFee",
    width: 92,
  },
  {
    key: "privateLessonFee",
    label: "Özel Ders",
    kind: "editable",
    editableField: "privateLessonFee",
    width: 92,
  },
  {
    key: "otherFee",
    label: "Diğer",
    kind: "editable",
    editableField: "otherFee",
    width: 80,
  },
  {
    key: "rowTotal",
    label: "Satır Toplamı",
    kind: "calculated",
    width: 88,
    render: (row) => formatMoney(calculateRowTotal(row)),
  },
  {
    key: "programTotal",
    label: "Teori + Direksiyon",
    kind: "calculated",
    width: 108,
    render: (row, rows) => formatMoney(calculateProgramTotal(rows, row.program.id)),
  },
];

const STICKY_OFFSETS = (() => {
  let offset = 0;
  const map = new Map<string, number>();
  for (const column of COLUMNS) {
    if (!column.sticky) continue;
    map.set(column.key, offset);
    offset += column.width ?? 0;
  }
  return map;
})();

function countDistinctPrograms(rows: CertificateProgramFeeRowResponse[]): number {
  const ids = new Set<string>();
  for (const row of rows) ids.add(row.program.id);
  return ids.size;
}

/** A row counts as "dolu" only when every editable field on it has a value. */
function isRowFullyFilled(row: CertificateProgramFeeRowResponse): boolean {
  return EDITABLE_FIELDS.every((field) => row[field.value] != null);
}

function countFullyFilledRows(rows: CertificateProgramFeeRowResponse[]): number {
  return rows.reduce((acc, row) => (isRowFullyFilled(row) ? acc + 1 : acc), 0);
}

/** Snapshot the editable fields of every row by key, so we can later
 *  detect which rows the user has touched since the last server sync. */
function snapshotEditableFields(
  rows: CertificateProgramFeeRowResponse[]
): Map<string, Partial<Record<EditableField, number | null>>> {
  const map = new Map<string, Partial<Record<EditableField, number | null>>>();
  for (const row of rows) {
    const fields: Partial<Record<EditableField, number | null>> = {};
    for (const field of EDITABLE_FIELDS) {
      fields[field.value] = row[field.value] as number | null;
    }
    map.set(rowKey(row), fields);
  }
  return map;
}

function isRowDirty(
  row: CertificateProgramFeeRowResponse,
  baseline: Map<string, Partial<Record<EditableField, number | null>>>
): boolean {
  const original = baseline.get(rowKey(row));
  if (!original) return EDITABLE_FIELDS.some((f) => row[f.value] != null);
  for (const field of EDITABLE_FIELDS) {
    if ((original[field.value] ?? null) !== ((row[field.value] as number | null) ?? null)) {
      return true;
    }
  }
  return false;
}

export function CertificateProgramFeeMatrixSettingsSection() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [rows, setRows] = useState<CertificateProgramFeeRowResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedTargets, setExpandedTargets] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState("");
  const [bulkLessonType, setBulkLessonType] = useState<"" | "theory" | "practice">("");
  const [bulkField, setBulkField] = useState<EditableField>("vatIncludedHourlyRate");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkVisible, setBulkVisible] = useState(false);
  const scopedBulkLessonType = getFieldLessonScope(bulkField);
  const effectiveBulkLessonType = scopedBulkLessonType ?? bulkLessonType;
  const bulkPanelRef = useRef<HTMLDivElement | null>(null);
  const baselineRef = useRef<Map<string, Partial<Record<EditableField, number | null>>>>(new Map());
  const [undoSnapshot, setUndoSnapshot] = useState<{
    rows: CertificateProgramFeeRowResponse[];
    label: string;
  } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const clearUndoTimer = () => {
    if (undoTimerRef.current != null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const offerUndo = (snapshot: CertificateProgramFeeRowResponse[], label: string) => {
    clearUndoTimer();
    setUndoSnapshot({ rows: snapshot, label });
    undoTimerRef.current = window.setTimeout(() => {
      setUndoSnapshot(null);
      undoTimerRef.current = null;
    }, 5000);
  };

  useEffect(() => () => clearUndoTimer(), []);

  /** Select a section as the bulk target: open the bulk panel, focus only
   *  that section in the list, and bring the panel into view. */
  const selectForBulk = (target: string) => {
    setBulkTarget(target);
    setBulkVisible(true);
    setExpandedTargets(new Set([target]));
    requestAnimationFrame(() => {
      bulkPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    getCertificateProgramFeeMatrix(year, undefined, controller.signal)
      .then((response) => {
        setRows(response.rows);
        baselineRef.current = snapshotEditableFields(response.rows);
        setExpandedTargets((current) => {
          if (current.size > 0) return current;
          return new Set(response.rows.slice(0, 40).map((row) => row.program.targetLicenseClass));
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast("Ücret matrisi yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey, showToast, year]);

  const sections = useMemo(() => {
    const map = new Map<string, CertificateProgramFeeRowResponse[]>();
    for (const row of rows) {
      const key = row.program.targetLicenseClass;
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      map.set(key, bucket);
    }

    return [...map.entries()].map(([target, sectionRows]) => ({
      target,
      rows: sectionRows.sort((a, b) => {
        const sourceCompare = a.program.sourceLicenseDisplayName.localeCompare(
          b.program.sourceLicenseDisplayName,
          "tr"
        );
        if (sourceCompare !== 0) return sourceCompare;
        if (a.program.sourceLicensePre2016 !== b.program.sourceLicensePre2016) {
          return a.program.sourceLicensePre2016 ? 1 : -1;
        }
        return compareLessonType(a, b);
      }),
    }));
  }, [rows]);

  const targetOptions = useMemo(
    () => sections.map((section) => section.target),
    [sections]
  );

  const affectedBulkRowCount = useMemo(
    () =>
      rows.filter((row) => {
        if (bulkTarget && row.program.targetLicenseClass !== bulkTarget) return false;
        if (effectiveBulkLessonType && row.lessonType !== effectiveBulkLessonType) return false;
        return true;
      }).length,
    [bulkTarget, effectiveBulkLessonType, rows]
  );

  const allExpanded =
    sections.length > 0 && sections.every((section) => expandedTargets.has(section.target));

  const dirtyRowKeys = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (isRowDirty(row, baselineRef.current)) set.add(rowKey(row));
    }
    return set;
  }, [rows]);
  const dirtyCount = dirtyRowKeys.size;
  const isDirty = dirtyCount > 0;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const updateRow = (key: string, field: EditableField, value: string) => {
    const parsed = parseAmount(value);
    setRows((current) =>
      current.map((row) => (rowKey(row) === key ? { ...row, [field]: parsed } : row))
    );
  };

  const toggleSection = (target: string) => {
    setExpandedTargets((current) => {
      const next = new Set(current);
      if (next.has(target)) {
        next.delete(target);
      } else {
        next.add(target);
      }
      return next;
    });
  };

  const setAllExpanded = (expand: boolean) => {
    setExpandedTargets(expand ? new Set(sections.map((s) => s.target)) : new Set());
  };

  const save = async () => {
    setSaving(true);
    try {
      const payloadRows = rows.filter((row) => row.id || hasEditableValue(row)).map(toUpsertRow);
      const response = await updateCertificateProgramFeeMatrix(year, { rows: payloadRows });
      setRows(response.rows);
      baselineRef.current = snapshotEditableFields(response.rows);
      showToast("Ücret matrisi kaydedildi");
    } catch {
      showToast("Ücret matrisi kaydedilemedi", "error");
    } finally {
      setSaving(false);
    }
  };

  const applyBulk = async () => {
    const value = parseAmount(bulkValue);
    const payload: CertificateProgramFeeBulkApplyRequest = {
      targetLicenseClass: bulkTarget || null,
      lessonType: effectiveBulkLessonType || null,
      field: BACKEND_FIELD_BY_EDITABLE_FIELD[bulkField],
      value,
    };
    const fieldLabel =
      EDITABLE_FIELDS.find((f) => f.value === bulkField)?.label ?? bulkField;
    const snapshot = rows;

    setSaving(true);
    try {
      const response = await bulkApplyCertificateProgramFeeMatrix(year, payload);
      setRows(response.rows);
      baselineRef.current = snapshotEditableFields(response.rows);
      offerUndo(snapshot, `Toplu giriş uygulandı (${fieldLabel})`);
    } catch {
      showToast("Toplu giriş uygulanamadı", "error");
    } finally {
      setSaving(false);
    }
  };

  const undoLastChange = async () => {
    if (!undoSnapshot) return;
    const snapshotByKey = new Map(undoSnapshot.rows.map((row) => [rowKey(row), row]));
    clearUndoTimer();
    setUndoSnapshot(null);
    setSaving(true);
    try {
      // Use the *current* rows (with fresh rowVersion) but overlay the
      // snapshot's editable values, so we restore old numbers without
      // tripping concurrency on the rows the bulk apply just touched.
      const merged = rows.map((current) => {
        const old = snapshotByKey.get(rowKey(current));
        if (!old) return current;
        const next = { ...current };
        for (const field of EDITABLE_FIELDS) {
          (next as Record<string, unknown>)[field.value] = old[field.value];
        }
        return next;
      });
      const payloadRows = merged
        .filter((row) => row.id || hasEditableValue(row))
        .map(toUpsertRow);
      const response = await updateCertificateProgramFeeMatrix(year, { rows: payloadRows });
      setRows(response.rows);
      baselineRef.current = snapshotEditableFields(response.rows);
      showToast("İşlem geri alındı");
    } catch {
      showToast("Geri alma başarısız", "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!saving && isDirty) save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, isDirty, year, rows]);

  const goBack = () => {
    const state = location.state as { from?: unknown } | null;
    const from = typeof state?.from === "string" && state.from !== location.pathname
      ? state.from
      : "/settings/general";
    navigate(from);
  };

  return (
    <div className="settings-section-stack">
      <div className="fee-matrix-backbar">
        <button className="btn btn-secondary btn-sm fee-matrix-back-button" onClick={goBack} type="button">
          <span aria-hidden="true">←</span>
          Geldiğin sayfaya dön
        </button>
      </div>
      <section className={`settings-surface fee-matrix${bulkVisible ? " fee-matrix--bulk-open" : ""}`}>
        <div className="settings-surface-header">
          <div>
            <div className="settings-surface-title">Ehliyet Ücret Matrisi</div>
            <div className="form-subsection-note">
              KDV oranı %10. <span className="fee-matrix-tag fee-matrix-tag--editable">Beyaz</span>{" "}
              alanlar girilebilir,{" "}
              <span className="fee-matrix-tag fee-matrix-tag--calculated">gri</span> alanlar
              otomatik hesaplanır.
            </div>
          </div>
          <div className="settings-module-actions fee-matrix-toolbar">
            <label className="fee-matrix-year-field">
              <span>Yıl</span>
              <input
                className="form-input fee-matrix-year-input"
                min={2000}
                max={2100}
                onChange={(event) => setYear(Number(event.target.value) || CURRENT_YEAR)}
                type="number"
                value={year}
              />
            </label>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setRefreshKey((x) => x + 1)}
              type="button"
            >
              Yenile
            </button>
            {sections.length > 0 ? (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setAllExpanded(!allExpanded)}
                type="button"
              >
                {allExpanded ? "Tümünü daralt" : "Tümünü genişlet"}
              </button>
            ) : null}
            {isDirty ? (
              <span className="fee-matrix-dirty-badge" title="Kaydedilmemiş değişiklik var">
                {dirtyCount} satır kaydedilmedi
              </span>
            ) : null}
            <button
              className="btn btn-primary btn-sm"
              disabled={saving || !isDirty}
              onClick={save}
              title={isDirty ? "Kaydet (⌘/Ctrl+S)" : "Değişiklik yok"}
              type="button"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <button
              aria-expanded={bulkVisible}
              className={`btn btn-sm ${bulkVisible ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setBulkVisible((current) => !current)}
              type="button"
            >
              {bulkVisible ? "Toplu girişi gizle" : "Toplu giriş"}
            </button>
          </div>
        </div>

        <div className="settings-surface-body fee-matrix-body">
          {bulkVisible ? (
          <div className="fee-matrix-bulk" ref={bulkPanelRef}>
            <div className="fee-matrix-bulk-header">
              <span className="fee-matrix-bulk-summary-title">
                Toplu giriş
                {bulkTarget ? (
                  <span className="fee-matrix-bulk-target-pill">{bulkTarget}</span>
                ) : null}
              </span>
              <span className="fee-matrix-bulk-summary-meta">
                {affectedBulkRowCount} satıra etki edecek
                {bulkTarget ? (
                  <button
                    className="fee-matrix-bulk-clear"
                    onClick={() => setBulkTarget("")}
                    title="Hedef ehliyet kısıtlamasını kaldır"
                    type="button"
                  >
                    × Tümünü kapsa
                  </button>
                ) : null}
              </span>
            </div>
            <div className="fee-matrix-bulk-grid">
              <label className="fee-matrix-bulk-field">
                <span>Hedef ehliyet</span>
                <CustomSelect
                  className="form-select"
                  onChange={(event) => setBulkTarget(event.target.value)}
                  value={bulkTarget}
                >
                  <option value="">Tümü</option>
                  {targetOptions.map((target) => (
                    <option key={target} value={target}>
                      {target} geçişleri
                    </option>
                  ))}
                </CustomSelect>
              </label>
              <label className="fee-matrix-bulk-field">
                <span>Ders türü</span>
                <CustomSelect
                  className="form-select"
                  disabled={scopedBulkLessonType !== null}
                  onChange={(event) =>
                    setBulkLessonType(event.target.value as "" | "theory" | "practice")
                  }
                  value={effectiveBulkLessonType}
                >
                  <option value="">Teorik + Direksiyon</option>
                  <option value="theory">Sadece teorik</option>
                  <option value="practice">Sadece direksiyon</option>
                </CustomSelect>
              </label>
              <label className="fee-matrix-bulk-field">
                <span>Alan</span>
                <CustomSelect
                  className="form-select"
                  onChange={(event) => setBulkField(event.target.value as EditableField)}
                  value={bulkField}
                >
                  {EDITABLE_FIELDS.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </CustomSelect>
              </label>
              <label className="fee-matrix-bulk-field">
                <span>Tutar</span>
                <input
                  className="form-input"
                  inputMode="decimal"
                  onChange={(event) => setBulkValue(event.target.value)}
                  placeholder="Örn. 1500,00 (boş = sıfırla)"
                  value={bulkValue}
                />
              </label>
              <div className="fee-matrix-bulk-action">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={saving || affectedBulkRowCount === 0}
                  onClick={applyBulk}
                  type="button"
                >
                  {affectedBulkRowCount > 0
                    ? `${affectedBulkRowCount} satıra uygula`
                    : "Etkilenen satır yok"}
                </button>
              </div>
            </div>
          </div>
          ) : null}

          {loading ? (
            <div className="instructor-detail-empty">Ücret matrisi yükleniyor...</div>
          ) : sections.length === 0 ? (
            <div className="instructor-detail-empty">
              Sertifika/program kaydı bulunmuyor. Önce müşteri varyasyonları programa
              aktarılmalı.
            </div>
          ) : (
            <div className="fee-matrix-sections">
              {sections.map((section) => {
                const expanded = expandedTargets.has(section.target);
                const isBulkTarget = bulkTarget === section.target;
                const programCount = countDistinctPrograms(section.rows);
                const filledRows = countFullyFilledRows(section.rows);
                const totalRows = section.rows.length;
                return (
                  <section
                    className={`fee-matrix-section${expanded ? " is-expanded" : ""}${
                      isBulkTarget ? " is-bulk-target" : ""
                    }`}
                    key={section.target}
                  >
                    <div className="fee-matrix-section-header-row">
                      <button
                        aria-expanded={expanded}
                        className="fee-matrix-section-header"
                        onClick={() => toggleSection(section.target)}
                        type="button"
                      >
                        <span aria-hidden="true" className="fee-matrix-section-chevron">
                          ▸
                        </span>
                        <span className="fee-matrix-section-title">
                          {section.target} geçişleri
                        </span>
                        <span className="fee-matrix-section-stats">
                          <span>{programCount} program</span>
                          <span>{section.rows.length} satır</span>
                          <span
                            className={
                              filledRows === totalRows
                                ? "fee-matrix-section-stat--filled"
                                : filledRows === 0
                                ? "fee-matrix-section-stat--empty"
                                : "fee-matrix-section-stat--partial"
                            }
                          >
                            {filledRows}/{totalRows} satır dolu
                          </span>
                        </span>
                      </button>
                      <button
                        className={`fee-matrix-section-bulk-btn${
                          isBulkTarget ? " is-active" : ""
                        }`}
                        onClick={() => selectForBulk(section.target)}
                        title={`Toplu girişi "${section.target} geçişleri" ile sınırla ve panele odaklan`}
                        type="button"
                      >
                        {isBulkTarget ? "Toplu Seçili" : "Toplu Seç"}
                      </button>
                    </div>
                    {expanded ? (
                      <div className="fee-matrix-table-scroll">
                        <table className="data-table fee-matrix-table">
                          <thead>
                            <tr>
                              {COLUMNS.map((column) => (
                                <th
                                  className={`fee-matrix-th fee-matrix-th--${column.kind}${
                                    column.sticky ? " fee-matrix-th--sticky" : ""
                                  }`}
                                  key={column.key}
                                  style={{
                                    minWidth: column.width,
                                    left: column.sticky
                                      ? STICKY_OFFSETS.get(column.key)
                                      : undefined,
                                  }}
                                  scope="col"
                                >
                                  {column.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {section.rows.map((row, index) => {
                              const key = rowKey(row);
                              const firstProgramRow = isFirstProgramRow(section.rows, row, index);
                              const programRowSpan = firstProgramRow
                                ? countProgramRows(section.rows, row.program.id)
                                : 1;
                              const dirty = dirtyRowKeys.has(key);
                              return (
                                <tr className={dirty ? "is-dirty" : undefined} key={key}>
                                  {COLUMNS.map((column) => {
                                    if (isMergedProgramColumn(column) && !firstProgramRow) {
                                      return null;
                                    }

                                    return (
                                      <MatrixCell
                                        column={column}
                                        key={column.key}
                                        row={row}
                                        rowKeyValue={key}
                                        rowSpan={
                                          isMergedProgramColumn(column) ? programRowSpan : undefined
                                        }
                                        sectionRows={section.rows}
                                        updateRow={updateRow}
                                      />
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </section>
      {undoSnapshot ? (
        <div className="fee-matrix-undo-snackbar" role="status">
          <span className="fee-matrix-undo-text">{undoSnapshot.label}</span>
          <button
            className="fee-matrix-undo-button"
            disabled={saving}
            onClick={undoLastChange}
            type="button"
          >
            Geri al
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MatrixCell({
  column,
  row,
  rowKeyValue,
  rowSpan,
  sectionRows,
  updateRow,
}: {
  column: Column;
  row: CertificateProgramFeeRowResponse;
  rowKeyValue: string;
  rowSpan?: number;
  sectionRows: CertificateProgramFeeRowResponse[];
  updateRow: (key: string, field: EditableField, value: string) => void;
}) {
  const stickyOffset = column.sticky ? STICKY_OFFSETS.get(column.key) : undefined;
  const baseClass = `fee-matrix-td fee-matrix-td--${column.kind}${
    column.sticky ? " fee-matrix-td--sticky" : ""
  }`;
  const style = {
    minWidth: column.width,
    left: stickyOffset,
  };

  if (column.kind === "editable" && column.editableField) {
    const field = column.editableField;
    // The lesson-scope (theory/practice) hint is only used by the bulk-apply
    // panel to limit which rows a value flows to. For per-row editing we let
    // the user enter a value on any row of the program — restricting it
    // confused users who landed on the "wrong" lesson row first.
    return (
      <td className={baseClass} rowSpan={rowSpan} style={style}>
        <EditableMoneyCell
          ariaLabel={column.label}
          disabled={false}
          field={field}
          row={row}
          rowKeyValue={rowKeyValue}
          updateRow={updateRow}
        />
      </td>
    );
  }

  return (
    <td className={baseClass} rowSpan={rowSpan} style={style}>
      {column.render?.(row, sectionRows)}
    </td>
  );
}

/**
 * Money input with local text state so the user can freely type partial /
 * decimal values (e.g. "1234,") without the controlled-input round-trip
 * eating the comma. The cell still pushes every keystroke to the parent so
 * Save/bulk apply pick up the latest value, but it suppresses the parent's
 * re-serialization unless the underlying number actually changed externally
 * (bulk apply, post-save reload).
 */
function EditableMoneyCell({
  ariaLabel,
  disabled,
  field,
  row,
  rowKeyValue,
  updateRow,
}: {
  ariaLabel: string;
  disabled: boolean;
  field: EditableField;
  row: CertificateProgramFeeRowResponse;
  rowKeyValue: string;
  updateRow: (key: string, field: EditableField, value: string) => void;
}) {
  const externalValue = disabled ? null : (row[field] as number | null);
  const [text, setText] = useState<string>(() => serializeAmount(externalValue));
  const lastEmittedRef = useRef<number | null>(externalValue);

  useEffect(() => {
    // Only resync from the parent when the value changed *externally* —
    // i.e. it's different from what this cell most recently emitted.
    if (externalValue !== lastEmittedRef.current) {
      lastEmittedRef.current = externalValue;
      setText(serializeAmount(externalValue));
    }
  }, [externalValue]);

  if (disabled) {
    return (
      <input
        aria-label={ariaLabel}
        className="form-input fee-matrix-money-input"
        disabled
        inputMode="decimal"
        value=""
      />
    );
  }

  return (
    <input
      aria-label={ariaLabel}
      className="form-input fee-matrix-money-input"
      inputMode="decimal"
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);
        lastEmittedRef.current = parseAmount(raw);
        updateRow(rowKeyValue, field, raw);
      }}
      placeholder="0,00"
      value={text}
    />
  );
}
