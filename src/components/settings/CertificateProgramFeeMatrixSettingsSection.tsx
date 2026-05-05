import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

import {
  bulkApplyCertificateProgramFeeMatrix,
  getCertificateProgramFeeMatrix,
  updateCertificateProgramFeeMatrix,
} from "../../lib/certificate-program-fee-matrix-api";
import type {
  CertificateProgramFeeBulkApplyRequest,
  CertificateProgramFeeProgramResponse,
  CertificateProgramFeeProgramUpsertRequest,
  CertificateProgramFeeRowResponse,
  CertificateProgramFeeRowUpsertRequest,
} from "../../lib/types";
import { useToast } from "../ui/Toast";

type StoredEditableField = keyof Pick<
  CertificateProgramFeeRowResponse,
  | "vatIncludedHourlyRate"
  | "contractTheoryExamFee"
  | "contractPracticeExamFee"
  | "institutionTheoryExamFee"
  | "institutionPracticeExamFee"
>;

/** Virtual editable fields:
 *  - "contractExamFee" / "institutionExamFee" collapse a per-lessonType pair
 *    of stored row fields into one column the user edits.
 *  - "courseFee" is *not* per-row at all — it lives in CertificateProgramYearFee
 *    keyed by (year, program), shared across both lesson rows of a program. */
/** Single source of truth for program-scoped (CertificateProgramYearFee)
 *  fields. Adding a new program-level fee here automatically propagates to:
 *    - isProgramScopedField type guard
 *    - readEditableValue lookup
 *    - updateRow patch
 *    - collectDirtyProgramFees baseline diff & payload */
const PROGRAM_FIELD_KEYS = [
  "courseFee",
  "mebbisFee",
  "failureRetryFee",
  "privateLessonFee",
  "educationFee",
  "otherFee1",
] as const satisfies ReadonlyArray<keyof CertificateProgramFeeProgramResponse>;

type ProgramScopedField = (typeof PROGRAM_FIELD_KEYS)[number];

type EditableField =
  | StoredEditableField
  | "contractExamFee"
  | "institutionExamFee"
  | ProgramScopedField;

const PROGRAM_FIELD_SET: ReadonlySet<EditableField> = new Set(PROGRAM_FIELD_KEYS);

function isProgramScopedField(field: EditableField): field is ProgramScopedField {
  return PROGRAM_FIELD_SET.has(field);
}

function readProgramFee(
  program: CertificateProgramFeeProgramResponse,
  field: ProgramScopedField
): number | null {
  return program[field] as number | null;
}

const EDITABLE_FIELDS: { value: EditableField; label: string }[] = [
  { value: "vatIncludedHourlyRate", label: "Saat Ücreti (KDV'li)" },
  { value: "contractExamFee", label: "Sözleşmeli Sınav Ücreti" },
  { value: "institutionExamFee", label: "Kurum Sınav Ücreti" },
  { value: "courseFee", label: "Kurs Ücreti" },
  { value: "mebbisFee", label: "MEBBİS Eğitim Ücreti" },
  { value: "failureRetryFee", label: "Başarısız Sınav Hak Ücreti" },
  { value: "privateLessonFee", label: "Özel Ders Ücreti" },
  { value: "educationFee", label: "Eğitim Ücreti" },
  { value: "otherFee1", label: "Diğer Ücret 1" },
];

/** Stored row-level fields → EF column names that the BulkApply endpoint
 *  expects in `field`. Virtual fields (contractExamFee, institutionExamFee,
 *  program-scoped) are routed by `applyBulkToSelected` separately. */
const BACKEND_FIELD_BY_STORED: Record<StoredEditableField, string> = {
  vatIncludedHourlyRate: "VatIncludedHourlyRate",
  contractTheoryExamFee: "ContractTheoryExamFee",
  contractPracticeExamFee: "ContractPracticeExamFee",
  institutionTheoryExamFee: "InstitutionTheoryExamFee",
  institutionPracticeExamFee: "InstitutionPracticeExamFee",
};

/** Virtual fields whose single column is logically two cells (one per
 *  lessonType). Bulk input must offer two slots so theory & practice can
 *  receive different values; otherwise typing one number would overwrite
 *  both halves of the program. */
type SplitExamField = "contractExamFee" | "institutionExamFee";
const SPLIT_EXAM_FIELDS: ReadonlySet<EditableField> = new Set<EditableField>([
  "contractExamFee",
  "institutionExamFee",
]);
function isSplitExamField(field: EditableField): field is SplitExamField {
  return SPLIT_EXAM_FIELDS.has(field);
}
function bulkValueKey(field: EditableField, lessonType?: "theory" | "practice"): string {
  return lessonType ? `${field}.${lessonType}` : field;
}

const ROW_EDITABLE_FIELDS = EDITABLE_FIELDS.filter(
  (field): field is { value: Exclude<EditableField, ProgramScopedField>; label: string } =>
    !isProgramScopedField(field.value)
);

/** Resolve a virtual exam-fee field to its concrete stored field for a
 *  given row's lessonType. All non-virtual fields pass through unchanged.
 *  Must NOT be called with program-scoped fields (e.g. "courseFee"). */
function resolveStoredField(
  field: Exclude<EditableField, ProgramScopedField>,
  lessonType: "theory" | "practice"
): StoredEditableField {
  if (field === "contractExamFee") {
    return lessonType === "theory" ? "contractTheoryExamFee" : "contractPracticeExamFee";
  }
  if (field === "institutionExamFee") {
    return lessonType === "theory" ? "institutionTheoryExamFee" : "institutionPracticeExamFee";
  }
  return field;
}

function readEditableValue(
  row: CertificateProgramFeeRowResponse,
  field: EditableField
): number | null {
  if (isProgramScopedField(field)) {
    return readProgramFee(row.program, field);
  }
  return row[resolveStoredField(field, row.lessonType)] as number | null;
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

function calculateLessonFeeVatExcluded(row: CertificateProgramFeeRowResponse): number | null {
  const vatExcludedHourlyRate = calculateVatExcludedHourlyRate(row);
  return vatExcludedHourlyRate == null
    ? null
    : roundMoney(vatExcludedHourlyRate * row.lessonHours);
}

/** Sum a per-row calculation across both lesson rows (theory + practice) of
 *  a program, so the contract subtotals can be shown once in a merged cell. */
function sumByProgram(
  rows: CertificateProgramFeeRowResponse[],
  programId: string,
  perRow: (row: CertificateProgramFeeRowResponse) => number | null
): number | null {
  let total = 0;
  let hasValue = false;
  for (const row of rows) {
    if (row.program.id !== programId) continue;
    const value = perRow(row);
    if (value == null) continue;
    total += value;
    hasValue = true;
  }
  return hasValue ? roundMoney(total) : null;
}

function rowKey(row: CertificateProgramFeeRowResponse): string {
  return `${row.program.id}:${row.lessonType}`;
}

function hasRowEditableValue(row: CertificateProgramFeeRowResponse): boolean {
  return ROW_EDITABLE_FIELDS.some((field) => readEditableValue(row, field.value) != null);
}

function toUpsertRow(row: CertificateProgramFeeRowResponse): CertificateProgramFeeRowUpsertRequest {
  const isTheory = row.lessonType === "theory";
  return {
    certificateProgramId: row.program.id,
    lessonType: row.lessonType,
    vatIncludedHourlyRate: row.vatIncludedHourlyRate,
    contractTheoryExamFee: isTheory ? row.contractTheoryExamFee : null,
    contractPracticeExamFee: isTheory ? null : row.contractPracticeExamFee,
    institutionTheoryExamFee: isTheory ? row.institutionTheoryExamFee : null,
    institutionPracticeExamFee: isTheory ? null : row.institutionPracticeExamFee,
    rowVersion: row.rowVersion,
  };
}

type ColumnKind = "info" | "calculated" | "editable";
type ColumnGroup = "contract" | "institution";
type Column = {
  key: string;
  label: string;
  /** Full, unabbreviated name shown as a hover tooltip when the visible label
   *  is shortened to fit the column width. */
  fullLabel?: string;
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
  /** Collapsible group this column belongs to. Sticky info columns stay grouped as "—". */
  group?: ColumnGroup;
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
  return (
    column.key === "select" ||
    column.key === "source" ||
    column.key === "target" ||
    column.key === "contractTotalLessonFeeVatExcluded" ||
    column.key === "contractTotalVat" ||
    (column.editableField ? isProgramScopedField(column.editableField) : false)
  );
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
    // Bulk-selection checkbox; rendered manually in the table body so it can
    // hook into selection state. The render here is just a placeholder.
    key: "select",
    label: "",
    kind: "info",
    sticky: true,
    width: 32,
    render: () => null,
  },
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
    fullLabel: "Ders Saati",
    kind: "info",
    width: 56,
    render: (row) => row.lessonHours,
  },
  {
    key: "contractExamFee",
    label: "Söz. Sınav",
    fullLabel: "Sözleşmeli Sınav Ücreti",
    kind: "editable",
    editableField: "contractExamFee",
    width: 88,
    group: "contract",
  },
  {
    key: "vatIncludedHourlyRate",
    label: "Saat KDV'li",
    fullLabel: "Saat Ücreti (KDV dahil)",
    kind: "editable",
    editableField: "vatIncludedHourlyRate",
    width: 92,
    group: "contract",
  },
  {
    key: "vatExcludedHourlyRate",
    label: "Saat KDV'siz",
    fullLabel: "Saat Ücreti (KDV hariç)",
    kind: "calculated",
    width: 80,
    render: (row) => formatMoney(calculateVatExcludedHourlyRate(row)),
    group: "contract",
  },
  {
    key: "lessonFee",
    label: "Ders Ücreti",
    fullLabel: "Toplam Ders Ücreti (Saat KDV'li × Ders Saati)",
    kind: "calculated",
    width: 84,
    render: (row) => formatMoney(calculateLessonFee(row)),
    group: "contract",
  },
  {
    key: "vatAmount",
    label: "KDV",
    fullLabel: "Toplam KDV Tutarı",
    kind: "calculated",
    width: 72,
    render: (row) => formatMoney(calculateVatAmount(row)),
    group: "contract",
  },
  {
    key: "contractTotalLessonFeeVatExcluded",
    label: "Söz. Top. KDV'siz",
    fullLabel: "Sözleşme Toplam Ders Ücreti (KDV hariç, Teorik + Direksiyon)",
    kind: "calculated",
    width: 104,
    render: (row, rows) =>
      formatMoney(sumByProgram(rows, row.program.id, calculateLessonFeeVatExcluded)),
    group: "contract",
  },
  {
    key: "contractTotalVat",
    label: "Söz. Top. KDV",
    fullLabel: "Sözleşme Toplam KDV (Teorik + Direksiyon)",
    kind: "calculated",
    width: 96,
    render: (row, rows) =>
      formatMoney(sumByProgram(rows, row.program.id, calculateVatAmount)),
    group: "contract",
  },
  {
    key: "institutionExamFee",
    label: "Sınav Ücreti",
    fullLabel: "Kurum Sınav Ücreti",
    kind: "editable",
    editableField: "institutionExamFee",
    width: 92,
    group: "institution",
  },
  {
    key: "courseFee",
    label: "Kurs Ücreti",
    fullLabel: "Kurs Ücreti (program bazında, ders türünden bağımsız)",
    kind: "editable",
    editableField: "courseFee",
    width: 96,
    group: "institution",
  },
  {
    key: "mebbisFee",
    label: "MEBBİS",
    fullLabel: "MEBBİS Eğitim Ücreti (program bazında, ders türünden bağımsız)",
    kind: "editable",
    editableField: "mebbisFee",
    width: 96,
    group: "institution",
  },
  {
    key: "failureRetryFee",
    label: "Başarısız Hak",
    fullLabel: "Başarısız Sınav Hak Ücreti (program bazında, ders türünden bağımsız)",
    kind: "editable",
    editableField: "failureRetryFee",
    width: 100,
    group: "institution",
  },
  {
    key: "privateLessonFee",
    label: "Özel Ders",
    fullLabel: "Özel Ders Ücreti (program bazında, ders türünden bağımsız)",
    kind: "editable",
    editableField: "privateLessonFee",
    width: 96,
    group: "institution",
  },
  {
    key: "educationFee",
    label: "Eğitim",
    fullLabel: "Eğitim Ücreti (program bazında, ders türünden bağımsız)",
    kind: "editable",
    editableField: "educationFee",
    width: 96,
    group: "institution",
  },
  {
    key: "otherFee1",
    label: "Diğer Ücret 1",
    fullLabel: "Diğer Ücret 1 (program bazında, ders türünden bağımsız)",
    kind: "editable",
    editableField: "otherFee1",
    width: 96,
    group: "institution",
  },
];

const GROUP_LABELS: Record<ColumnGroup, string> = {
  contract: "Sözleşme",
  institution: "Kurum",
};

const GROUP_COLLAPSED_WIDTH = 132;

function countGroupColumns(group: ColumnGroup): number {
  return COLUMNS.reduce((acc, column) => (column.group === group ? acc + 1 : acc), 0);
}

function countLeadingUngroupedColumns(): number {
  let count = 0;
  for (const column of COLUMNS) {
    if (column.group) break;
    count += 1;
  }
  return count;
}

function renderGroupHeaderCells(
  collapsedGroups: Set<ColumnGroup>,
  toggleGroup: (group: ColumnGroup) => void
): React.ReactNode {
  const leadingCount = countLeadingUngroupedColumns();
  const cells: React.ReactNode[] = [];

  if (leadingCount > 0) {
    cells.push(
      <th
        aria-hidden="true"
        className="fee-matrix-group-th fee-matrix-group-th--spacer"
        colSpan={leadingCount}
        key="lead-spacer"
      />
    );
  }

  for (const group of ["contract", "institution"] as ColumnGroup[]) {
    const isCollapsed = collapsedGroups.has(group);
    const span = isCollapsed ? 1 : countGroupColumns(group);
    cells.push(
      <th
        className={`fee-matrix-group-th fee-matrix-group-th--${group}${
          isCollapsed ? " is-collapsed" : ""
        }`}
        colSpan={span}
        key={`group-${group}`}
        scope="colgroup"
      >
        <button
          aria-expanded={!isCollapsed}
          className="fee-matrix-group-toggle"
          onClick={() => toggleGroup(group)}
          title={isCollapsed ? "Grubu aç" : "Grubu kapat"}
          type="button"
        >
          <span aria-hidden="true" className="fee-matrix-group-toggle-chevron">
            {isCollapsed ? "▸" : "▾"}
          </span>
          <span className="fee-matrix-group-toggle-label">{GROUP_LABELS[group]}</span>
        </button>
      </th>
    );
  }

  return cells;
}

/** Sticky `left` offsets per column key. The select-checkbox column appears
 *  only in selection mode, so its width must be excluded from the offsets
 *  when the mode is off — otherwise every other sticky cell would render
 *  shifted right by the missing column's width. */
function buildStickyOffsets(includeSelect: boolean): Map<string, number> {
  let offset = 0;
  const map = new Map<string, number>();
  for (const column of COLUMNS) {
    if (!column.sticky) continue;
    if (column.key === "select" && !includeSelect) continue;
    map.set(column.key, offset);
    offset += column.width ?? 0;
  }
  return map;
}

function countDistinctPrograms(rows: CertificateProgramFeeRowResponse[]): number {
  const ids = new Set<string>();
  for (const row of rows) ids.add(row.program.id);
  return ids.size;
}

/** A row counts as "dolu" only when every editable field on it has a value. */
function isRowFullyFilled(row: CertificateProgramFeeRowResponse): boolean {
  return EDITABLE_FIELDS.every((field) => readEditableValue(row, field.value) != null);
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
      fields[field.value] = readEditableValue(row, field.value);
    }
    map.set(rowKey(row), fields);
  }
  return map;
}

/** Build the programs[] payload for save: one entry per program whose
 *  any program-scoped fee diverged from baseline since the last sync. The
 *  payload always includes all current values so the backend can persist
 *  them together (a single CertificateProgramYearFee row holds them all). */
function collectDirtyProgramFees(
  rows: CertificateProgramFeeRowResponse[],
  baseline: Map<string, Partial<Record<EditableField, number | null>>>
): CertificateProgramFeeProgramUpsertRequest[] {
  const result: CertificateProgramFeeProgramUpsertRequest[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.program.id)) continue;
    seen.add(row.program.id);
    const original = baseline.get(rowKey(row));
    const currentByKey: Partial<Record<ProgramScopedField, number | null>> = {};
    let dirty = false;
    for (const key of PROGRAM_FIELD_KEYS) {
      const baselineValue = original?.[key] ?? null;
      const currentValue = readProgramFee(row.program, key) ?? null;
      currentByKey[key] = currentValue;
      if (baselineValue !== currentValue) dirty = true;
    }
    if (!dirty) continue;
    result.push({
      certificateProgramId: row.program.id,
      ...currentByKey,
      rowVersion: row.program.yearFeeRowVersion,
    });
  }
  return result;
}

function isRowDirty(
  row: CertificateProgramFeeRowResponse,
  baseline: Map<string, Partial<Record<EditableField, number | null>>>
): boolean {
  const original = baseline.get(rowKey(row));
  if (!original) return EDITABLE_FIELDS.some((f) => readEditableValue(row, f.value) != null);
  for (const field of EDITABLE_FIELDS) {
    if ((original[field.value] ?? null) !== (readEditableValue(row, field.value) ?? null)) {
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<ColumnGroup>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<string>>(new Set());
  /** Values currently typed into the inline bulk-apply row.
   *  Key is either the EditableField name (e.g. "courseFee") for single-slot
   *  fields, or "<field>.theory" / "<field>.practice" for the split exam-fee
   *  columns where theory and practice need independent values. */
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  const baselineRef = useRef<Map<string, Partial<Record<EditableField, number | null>>>>(new Map());

  const visibleColumns = useMemo(
    () => COLUMNS.filter((column) => column.key !== "select" || selectionMode),
    [selectionMode]
  );
  const stickyOffsets = useMemo(() => buildStickyOffsets(selectionMode), [selectionMode]);

  const toggleProgramSelection = (programId: string) => {
    setSelectedProgramIds((current) => {
      const next = new Set(current);
      if (next.has(programId)) next.delete(programId);
      else next.add(programId);
      return next;
    });
  };

  const clearProgramSelection = () => setSelectedProgramIds(new Set());

  const toggleSelectionMode = () => {
    setSelectionMode((current) => {
      const next = !current;
      if (!next) {
        // Leaving selection mode: drop any pending selection + bulk inputs
        // so reopening starts from a clean slate.
        setSelectedProgramIds(new Set());
        setBulkValues({});
      }
      return next;
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
    if (isProgramScopedField(field)) {
      // Program-scoped fees live on the program, not the row. The clicked
      // cell identifies the program via its rowKey; mirror the new value
      // onto every row of that program so the UI stays consistent.
      const target = rows.find((r) => rowKey(r) === key);
      if (!target) return;
      const programId = target.program.id;
      const programPatch: Partial<CertificateProgramFeeProgramResponse> = { [field]: parsed };
      setRows((current) =>
        current.map((row) =>
          row.program.id === programId
            ? { ...row, program: { ...row.program, ...programPatch } }
            : row
        )
      );
      return;
    }
    setRows((current) =>
      current.map((row) => {
        if (rowKey(row) !== key) return row;
        const stored = resolveStoredField(field, row.lessonType);
        return { ...row, [stored]: parsed };
      })
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

  const toggleGroup = (group: ColumnGroup) => {
    setCollapsedGroups((current) => {
      const otherGroup: ColumnGroup = group === "contract" ? "institution" : "contract";
      if (current.has(group)) {
        // Opening this group → collapse the other one so only one stays open.
        return new Set<ColumnGroup>([otherGroup]);
      }
      // Closing this group → open the other one.
      return new Set<ColumnGroup>([group]);
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payloadRows = rows.filter((row) => row.id || hasRowEditableValue(row)).map(toUpsertRow);
      const payloadPrograms = collectDirtyProgramFees(rows, baselineRef.current);
      const response = await updateCertificateProgramFeeMatrix(year, {
        rows: payloadRows,
        programs: payloadPrograms,
      });
      setRows(response.rows);
      baselineRef.current = snapshotEditableFields(response.rows);
      showToast("Ücret matrisi kaydedildi");
    } catch {
      showToast("Ücret matrisi kaydedilemedi", "error");
    } finally {
      setSaving(false);
    }
  };

  const selectionCount = selectedProgramIds.size;

  const setBulkValueFor = (
    field: EditableField,
    lessonType: "theory" | "practice" | undefined,
    value: string
  ) => {
    const key = bulkValueKey(field, lessonType);
    setBulkValues((current) => ({ ...current, [key]: value }));
  };

  /** Push the value typed into the bulk-row's column for `field` to every
   *  selected program. For split exam fields, `lessonType` picks which half
   *  receives the value; otherwise the call covers both halves (or the whole
   *  program-scoped fee). Returns whether the call ran so the caller can
   *  decide whether to clear the input. */
  const applyBulkField = async (
    field: EditableField,
    lessonType?: "theory" | "practice"
  ): Promise<boolean> => {
    const key = bulkValueKey(field, lessonType);
    const parsed = parseAmount(bulkValues[key] ?? "");
    if (parsed == null) return false;
    const targetIds = Array.from(selectedProgramIds);
    if (targetIds.length === 0) return false;

    // Map the virtual/stored editable field to backend bulk-apply expansions.
    let expansions: { backendField: string; lessonType: "theory" | "practice" | null }[];
    if (isProgramScopedField(field)) {
      expansions = [{ backendField: `yearFee.${field}`, lessonType: null }];
    } else if (field === "contractExamFee") {
      const all = [
        { backendField: "ContractTheoryExamFee", lessonType: "theory" as const },
        { backendField: "ContractPracticeExamFee", lessonType: "practice" as const },
      ];
      expansions = lessonType ? all.filter((e) => e.lessonType === lessonType) : all;
    } else if (field === "institutionExamFee") {
      const all = [
        { backendField: "InstitutionTheoryExamFee", lessonType: "theory" as const },
        { backendField: "InstitutionPracticeExamFee", lessonType: "practice" as const },
      ];
      expansions = lessonType ? all.filter((e) => e.lessonType === lessonType) : all;
    } else {
      expansions = [
        {
          backendField: BACKEND_FIELD_BY_STORED[field as StoredEditableField],
          lessonType: null,
        },
      ];
    }

    setSaving(true);
    try {
      let lastResponse: { rows: CertificateProgramFeeRowResponse[] } | null = null;
      for (const expansion of expansions) {
        const payload: CertificateProgramFeeBulkApplyRequest = {
          targetLicenseClass: null,
          certificateProgramIds: targetIds,
          lessonType: expansion.lessonType,
          field: expansion.backendField,
          value: parsed,
        };
        lastResponse = await bulkApplyCertificateProgramFeeMatrix(year, payload);
      }
      if (lastResponse) {
        setRows(lastResponse.rows);
        baselineRef.current = snapshotEditableFields(lastResponse.rows);
      }
      const fieldLabel = EDITABLE_FIELDS.find((f) => f.value === field)?.label ?? field;
      const lessonSuffix =
        lessonType === "theory" ? " (Teorik)" : lessonType === "practice" ? " (Direksiyon)" : "";
      showToast(`${targetIds.length} programa "${fieldLabel}${lessonSuffix}" uygulandı`);
      setBulkValueFor(field, lessonType, "");
      return true;
    } catch {
      showToast("Toplu uygulama başarısız", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  /** Visual-feedback helper for the bulk-row column highlight: does the
   *  user have a parseable amount typed for this column right now? Split
   *  exam fields highlight if either of the two slots is filled. */
  const bulkColumnHasValue = (field: EditableField): boolean => {
    if (isSplitExamField(field)) {
      return (
        parseAmount(bulkValues[bulkValueKey(field, "theory")] ?? "") != null ||
        parseAmount(bulkValues[bulkValueKey(field, "practice")] ?? "") != null
      );
    }
    return parseAmount(bulkValues[bulkValueKey(field)] ?? "") != null;
  };

  /** Apply every column whose bulk input has a parseable value. Split exam
   *  fields contribute one job per filled side. Run sequentially so backend
   *  writes stay ordered and we don't race ourselves on RowVersion. */
  const applyAllBulkFields = async () => {
    const jobs: { field: EditableField; lessonType?: "theory" | "practice" }[] = [];
    for (const f of EDITABLE_FIELDS) {
      if (isSplitExamField(f.value)) {
        for (const lessonType of ["theory", "practice"] as const) {
          if (parseAmount(bulkValues[bulkValueKey(f.value, lessonType)] ?? "") != null) {
            jobs.push({ field: f.value, lessonType });
          }
        }
      } else if (parseAmount(bulkValues[bulkValueKey(f.value)] ?? "") != null) {
        jobs.push({ field: f.value });
      }
    }
    if (jobs.length === 0) return;
    for (const job of jobs) {
      // eslint-disable-next-line no-await-in-loop
      await applyBulkField(job.field, job.lessonType);
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
      <section className="settings-surface fee-matrix">
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
            {selectionMode ? null : (
              <>
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
              </>
            )}
            {sections.length > 0 ? (
              <button
                className={`btn btn-secondary btn-sm${selectionMode ? " active" : ""}`}
                onClick={toggleSelectionMode}
                type="button"
              >
                {selectionMode ? "Seçimi kapat" : "Toplu seçim"}
              </button>
            ) : null}
            {selectionMode ? null : (
              <button
                className="btn btn-primary btn-sm"
                disabled={saving || !isDirty}
                onClick={save}
                title={isDirty ? "Kaydet (⌘/Ctrl+S)" : "Değişiklik yok"}
                type="button"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            )}
          </div>
        </div>

        <div className="settings-surface-body fee-matrix-body">
          {selectionMode ? (
            <div className="fee-matrix-bulk-hint" role="status">
              <span>
                {selectionCount > 0
                  ? `${selectionCount} program seçili. `
                  : "Satırların başındaki kutucuklardan program seçin. "}
                Tablo başlığının altındaki satıra değer yazıp Enter'a basın —
                seçili tüm programlarda o alan <em>üzerine yazılır</em>.
              </span>
              <div className="fee-matrix-bulk-hint-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={saving || selectionCount === 0}
                  onClick={clearProgramSelection}
                  type="button"
                >
                  Seçimi temizle
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={
                    saving ||
                    selectionCount === 0 ||
                    EDITABLE_FIELDS.every((f) => !bulkColumnHasValue(f.value))
                  }
                  onClick={applyAllBulkFields}
                  title="Toplu satırdaki tüm dolu input'ları sırayla uygula"
                  type="button"
                >
                  Tümünü uygula
                </button>
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
                const programCount = countDistinctPrograms(section.rows);
                const filledRows = countFullyFilledRows(section.rows);
                const totalRows = section.rows.length;
                const sectionSelection = (() => {
                  const programIds = Array.from(
                    new Set(section.rows.map((r) => r.program.id))
                  );
                  const selectedCount = programIds.reduce(
                    (acc, id) => (selectedProgramIds.has(id) ? acc + 1 : acc),
                    0
                  );
                  return {
                    programIds,
                    allSelected: programIds.length > 0 && selectedCount === programIds.length,
                    someSelected: selectedCount > 0,
                  };
                })();
                return (
                  <section
                    className={`fee-matrix-section${expanded ? " is-expanded" : ""}`}
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
                    </div>
                    {expanded ? (
                      <div className="fee-matrix-table-scroll">
                        <table className="data-table fee-matrix-table">
                          <thead>
                            <tr className="fee-matrix-group-row">
                              {renderGroupHeaderCells(collapsedGroups, toggleGroup)}
                            </tr>
                            <tr>
                              {visibleColumns.map((column, columnIndex) => {
                                if (column.group && collapsedGroups.has(column.group)) {
                                  return null;
                                }
                                const tooltip = column.fullLabel ?? column.label;
                                const showTooltip = tooltip !== column.label;
                                // Inject the collapsed-contract summary header
                                // immediately before the first institution column
                                // so it sits to the *left* of the Kurum group.
                                const injectContractSummary =
                                  collapsedGroups.has("contract") &&
                                  column.group === "institution" &&
                                  visibleColumns.findIndex((c) => c.group === "institution") ===
                                    columnIndex;
                                return (
                                  <Fragment key={column.key}>
                                    {injectContractSummary ? (
                                      <th
                                        className="fee-matrix-th fee-matrix-th--calculated fee-matrix-th--group-summary fee-matrix-th--group-contract"
                                        scope="col"
                                        style={{ minWidth: GROUP_COLLAPSED_WIDTH }}
                                      >
                                        <ColumnHeaderLabel
                                          label="Söz. Top. Ders KDV'siz"
                                          tooltip="Sözleşme Toplam Ders Ücreti (KDV hariç, Teorik + Direksiyon)"
                                        />
                                      </th>
                                    ) : null}
                                    <th
                                      className={`fee-matrix-th fee-matrix-th--${column.kind} fee-matrix-th--key-${column.key}${
                                        column.sticky ? " fee-matrix-th--sticky" : ""
                                      }${column.group ? ` fee-matrix-th--group-${column.group}` : ""}${
                                        selectionMode &&
                                        column.editableField &&
                                        bulkColumnHasValue(column.editableField)
                                          ? " is-bulk-target"
                                          : ""
                                      }`}
                                      style={{
                                        minWidth: column.width,
                                        left: column.sticky
                                          ? stickyOffsets.get(column.key)
                                          : undefined,
                                      }}
                                      scope="col"
                                    >
                                      {column.key === "select" ? (
                                        <input
                                          aria-label={`${section.target} bölümündeki tüm programları seç`}
                                          checked={sectionSelection.allSelected}
                                          className="fee-matrix-row-checkbox"
                                          onChange={() =>
                                            setSelectedProgramIds((current) => {
                                              const next = new Set(current);
                                              if (sectionSelection.allSelected) {
                                                for (const id of sectionSelection.programIds) {
                                                  next.delete(id);
                                                }
                                              } else {
                                                for (const id of sectionSelection.programIds) {
                                                  next.add(id);
                                                }
                                              }
                                              return next;
                                            })
                                          }
                                          ref={(el) => {
                                            if (el) {
                                              el.indeterminate =
                                                sectionSelection.someSelected &&
                                                !sectionSelection.allSelected;
                                            }
                                          }}
                                          type="checkbox"
                                        />
                                      ) : showTooltip ? (
                                        <ColumnHeaderLabel label={column.label} tooltip={tooltip} />
                                      ) : (
                                        column.label
                                      )}
                                    </th>
                                  </Fragment>
                                );
                              })}
                              {/* Contract group fully collapsed AND institution group also collapsed:
                                   the inject-before-institution branch above never fires (no institution
                                   columns rendered), so fall back to appending the contract summary here. */}
                              {collapsedGroups.has("contract") && collapsedGroups.has("institution") ? (
                                <th
                                  className="fee-matrix-th fee-matrix-th--calculated fee-matrix-th--group-summary fee-matrix-th--group-contract"
                                  key="contract-summary-fallback"
                                  scope="col"
                                  style={{ minWidth: GROUP_COLLAPSED_WIDTH }}
                                >
                                  <ColumnHeaderLabel
                                    label="Söz. Top. Ders KDV'siz"
                                    tooltip="Sözleşme Toplam Ders Ücreti (KDV hariç, Teorik + Direksiyon)"
                                  />
                                </th>
                              ) : null}
                            </tr>
                            {selectionMode ? (
                              <tr className="fee-matrix-bulk-row">
                                {visibleColumns.map((column) => {
                                  if (column.group && collapsedGroups.has(column.group)) {
                                    return null;
                                  }
                                  const stickyLeft = column.sticky
                                    ? stickyOffsets.get(column.key)
                                    : undefined;
                                  const cellClass = `fee-matrix-th fee-matrix-bulk-cell fee-matrix-th--key-${column.key}${
                                    column.sticky ? " fee-matrix-th--sticky" : ""
                                  }${column.group ? ` fee-matrix-th--group-${column.group}` : ""}`;

                                  if (column.key === "select") {
                                    return (
                                      <th
                                        className={`${cellClass} fee-matrix-bulk-cell--label`}
                                        key={column.key}
                                        scope="row"
                                        style={{ minWidth: column.width, left: stickyLeft }}
                                      >
                                        Toplu
                                      </th>
                                    );
                                  }
                                  if (!column.editableField) {
                                    return (
                                      <th
                                        aria-hidden="true"
                                        className={cellClass}
                                        key={column.key}
                                        style={{ minWidth: column.width, left: stickyLeft }}
                                      />
                                    );
                                  }
                                  const field = column.editableField;
                                  const fieldLabel =
                                    EDITABLE_FIELDS.find((f) => f.value === field)?.label ?? field;
                                  if (isSplitExamField(field)) {
                                    // Two side-by-side inputs: theory ("T") and
                                    // practice ("D"), so the user can target
                                    // each lesson row independently.
                                    return (
                                      <th
                                        className={`${cellClass} fee-matrix-bulk-cell--split`}
                                        key={column.key}
                                        style={{ minWidth: column.width, left: stickyLeft }}
                                      >
                                        {(["theory", "practice"] as const).map((lessonType) => {
                                          const slotKey = bulkValueKey(field, lessonType);
                                          const slotLabel =
                                            lessonType === "theory" ? "T" : "D";
                                          const slotTitle =
                                            lessonType === "theory"
                                              ? `${fieldLabel} (Teorik) için değer girip Enter'a basın`
                                              : `${fieldLabel} (Direksiyon) için değer girip Enter'a basın`;
                                          return (
                                            <input
                                              aria-label={`${fieldLabel} ${
                                                lessonType === "theory" ? "Teorik" : "Direksiyon"
                                              } için toplu değer`}
                                              className="form-input fee-matrix-bulk-input fee-matrix-bulk-input--split"
                                              disabled={saving || selectionCount === 0}
                                              inputMode="decimal"
                                              key={lessonType}
                                              onChange={(event) =>
                                                setBulkValueFor(
                                                  field,
                                                  lessonType,
                                                  event.target.value
                                                )
                                              }
                                              onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                  event.preventDefault();
                                                  void applyBulkField(field, lessonType);
                                                }
                                              }}
                                              placeholder={slotLabel}
                                              title={slotTitle}
                                              value={bulkValues[slotKey] ?? ""}
                                            />
                                          );
                                        })}
                                      </th>
                                    );
                                  }
                                  const value = bulkValues[bulkValueKey(field)] ?? "";
                                  return (
                                    <th
                                      className={cellClass}
                                      key={column.key}
                                      style={{ minWidth: column.width, left: stickyLeft }}
                                    >
                                      <input
                                        aria-label={`${fieldLabel} için toplu değer`}
                                        className="form-input fee-matrix-bulk-input"
                                        disabled={saving || selectionCount === 0}
                                        inputMode="decimal"
                                        onChange={(event) =>
                                          setBulkValueFor(field, undefined, event.target.value)
                                        }
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter") {
                                            event.preventDefault();
                                            void applyBulkField(field);
                                          }
                                        }}
                                        placeholder="—"
                                        title={`${fieldLabel} için değer girip Enter'a basın`}
                                        value={value}
                                      />
                                    </th>
                                  );
                                })}
                                {/* Mirror the contract-summary insertion in the header */}
                                {collapsedGroups.has("contract") &&
                                collapsedGroups.has("institution") ? (
                                  <th
                                    aria-hidden="true"
                                    className="fee-matrix-th fee-matrix-bulk-cell"
                                    key="contract-summary-bulk-fallback"
                                  />
                                ) : null}
                              </tr>
                            ) : null}
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
                                  {visibleColumns.map((column, columnIndex) => {
                                    if (column.group && collapsedGroups.has(column.group)) {
                                      return null;
                                    }
                                    if (isMergedProgramColumn(column) && !firstProgramRow) {
                                      return null;
                                    }
                                    // Mirror the header: inject the contract
                                    // summary cell to the *left* of the first
                                    // institution column.
                                    const injectContractSummary =
                                      collapsedGroups.has("contract") &&
                                      firstProgramRow &&
                                      column.group === "institution" &&
                                      visibleColumns.findIndex((c) => c.group === "institution") ===
                                        columnIndex;

                                    return (
                                      <Fragment key={column.key}>
                                        {injectContractSummary ? (
                                          <td
                                            className="fee-matrix-td fee-matrix-td--calculated fee-matrix-td--group-summary fee-matrix-td--group-contract"
                                            rowSpan={programRowSpan}
                                            style={{ minWidth: GROUP_COLLAPSED_WIDTH }}
                                          >
                                            {formatMoney(
                                              sumByProgram(
                                                section.rows,
                                                row.program.id,
                                                calculateLessonFeeVatExcluded
                                              )
                                            )}
                                          </td>
                                        ) : null}
                                        <MatrixCell
                                          column={column}
                                          isBulkTarget={
                                            selectionMode &&
                                            column.editableField !== undefined &&
                                            bulkColumnHasValue(column.editableField)
                                          }
                                          onToggleSelect={toggleProgramSelection}
                                          row={row}
                                          rowKeyValue={key}
                                          rowSpan={
                                            isMergedProgramColumn(column) ? programRowSpan : undefined
                                          }
                                          sectionRows={section.rows}
                                          selected={selectedProgramIds.has(row.program.id)}
                                          stickyOffsets={stickyOffsets}
                                          updateRow={updateRow}
                                        />
                                      </Fragment>
                                    );
                                  })}
                                  {/* Both groups collapsed: the inject-before-institution branch
                                       above never runs; emit the contract summary here as a fallback. */}
                                  {collapsedGroups.has("contract") &&
                                  collapsedGroups.has("institution") &&
                                  firstProgramRow ? (
                                    <td
                                      className="fee-matrix-td fee-matrix-td--calculated fee-matrix-td--group-summary fee-matrix-td--group-contract"
                                      key="contract-summary-fallback"
                                      rowSpan={programRowSpan}
                                      style={{ minWidth: GROUP_COLLAPSED_WIDTH }}
                                    >
                                      {formatMoney(
                                        sumByProgram(
                                          section.rows,
                                          row.program.id,
                                          calculateLessonFeeVatExcluded
                                        )
                                      )}
                                    </td>
                                  ) : null}
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
  selected,
  stickyOffsets,
  onToggleSelect,
  isBulkTarget,
}: {
  column: Column;
  row: CertificateProgramFeeRowResponse;
  rowKeyValue: string;
  rowSpan?: number;
  sectionRows: CertificateProgramFeeRowResponse[];
  updateRow: (key: string, field: EditableField, value: string) => void;
  selected: boolean;
  stickyOffsets: Map<string, number>;
  onToggleSelect: (programId: string) => void;
  isBulkTarget: boolean;
}) {
  const stickyOffset = column.sticky ? stickyOffsets.get(column.key) : undefined;
  const baseClass = `fee-matrix-td fee-matrix-td--${column.kind} fee-matrix-td--key-${column.key}${
    column.sticky ? " fee-matrix-td--sticky" : ""
  }${column.group ? ` fee-matrix-td--group-${column.group}` : ""}${
    isBulkTarget ? " is-bulk-target" : ""
  }`;
  const style = {
    minWidth: column.width,
    left: stickyOffset,
  };

  if (column.key === "select") {
    return (
      <td className={baseClass} rowSpan={rowSpan} style={style}>
        <input
          aria-label={`${row.program.sourceLicenseDisplayName} → ${row.program.targetLicenseDisplayName} programını seç`}
          checked={selected}
          className="fee-matrix-row-checkbox"
          onChange={() => onToggleSelect(row.program.id)}
          type="checkbox"
        />
      </td>
    );
  }

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
  const externalValue = disabled ? null : readEditableValue(row, field);
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

/** Column header with a portal-rendered tooltip that escapes the table's
 *  overflow:auto clip. Native <th title="..."> works but is sluggish and
 *  easy to miss on short uppercase labels, so we render our own. */
function ColumnHeaderLabel({ label, tooltip }: { label: string; tooltip: string }) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const showTooltip = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
  };
  const hideTooltip = () => setCoords(null);

  return (
    <>
      <span
        className="fee-matrix-th-label"
        onBlur={hideTooltip}
        onFocus={showTooltip}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        ref={anchorRef}
        tabIndex={0}
      >
        {label}
      </span>
      {coords
        ? createPortal(
            <div
              className="fee-matrix-th-tooltip"
              role="tooltip"
              style={{ top: coords.top, left: coords.left }}
            >
              {tooltip}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
