import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import {
  bulkApplyLicenseClassFeeMatrix,
  getLicenseClassFeeMatrix,
  updateLicenseClassFeeMatrix,
} from "../../lib/license-class-fee-matrix-api";
import { useAuth } from "../../lib/auth";
import { canManageArea } from "../../lib/permissions";
import { candidateKeys } from "../../lib/queries/use-candidates";
import type {
  LicenseClassFeeBulkApplyRequest,
  LicenseClassFeeProgramResponse,
  LicenseClassFeeProgramUpsertRequest,
  LicenseClassFeeRowResponse,
  LicenseClassFeeRowUpsertRequest,
} from "../../lib/types";
import { useToast } from "../ui/Toast";
import { useT, currentLocale, type TranslationKey } from "../../lib/i18n";

type StoredEditableField = keyof Pick<
  LicenseClassFeeRowResponse,
  | "vatIncludedHourlyRate"
  | "contractTheoryExamFee"
  | "contractPracticeExamFee"
  | "institutionTheoryExamFee"
  | "institutionPracticeExamFee"
>;

/** Virtual editable fields:
 *  - "contractExamFee" / "institutionExamFee" collapse a per-lessonType pair
 *    of stored row fields into one column the user edits.
 *  - "courseFee" is *not* per-row at all — it lives in LicenseClassYearFee
 *    keyed by (year, program), shared across both lesson rows of a program. */
/** Single source of truth for program-scoped (LicenseClassYearFee)
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
] as const satisfies ReadonlyArray<keyof LicenseClassFeeProgramResponse>;

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
  program: LicenseClassFeeProgramResponse,
  field: ProgramScopedField
): number | null {
  return program[field] as number | null;
}

const EDITABLE_FIELDS: { value: EditableField; labelKey: TranslationKey }[] = [
  { value: "vatIncludedHourlyRate", labelKey: "feeMatrix.editable.hourlyRate" },
  { value: "contractExamFee", labelKey: "feeMatrix.editable.contractExamFee" },
  { value: "institutionExamFee", labelKey: "feeMatrix.editable.institutionExamFee" },
  { value: "courseFee", labelKey: "feeMatrix.editable.courseFee" },
  { value: "mebbisFee", labelKey: "feeMatrix.editable.mebbisFee" },
  { value: "failureRetryFee", labelKey: "feeMatrix.editable.failureRetry" },
  { value: "privateLessonFee", labelKey: "feeMatrix.editable.privateLesson" },
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

function isDualLessonBulkField(
  field: EditableField
): field is "vatIncludedHourlyRate" | "contractExamFee" | "institutionExamFee" {
  return (
    field === "vatIncludedHourlyRate" ||
    field === "contractExamFee" ||
    field === "institutionExamFee"
  );
}
function bulkValueKey(field: EditableField, lessonType?: "theory" | "practice"): string {
  return lessonType ? `${field}.${lessonType}` : field;
}

const ROW_EDITABLE_FIELDS = EDITABLE_FIELDS.filter(
  (field): field is { value: Exclude<EditableField, ProgramScopedField>; labelKey: TranslationKey } =>
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
  row: LicenseClassFeeRowResponse,
  field: EditableField
): number | null {
  if (isProgramScopedField(field)) {
    return readProgramFee(row.program, field);
  }
  return row[resolveStoredField(field, row.lessonType)] as number | null;
}

const CURRENT_YEAR = new Date().getFullYear();
const VAT_RATE = 0.1;
// Section key for rows whose source license is "YOK" (candidates starting from
// scratch). Kept distinct from any real target license code.
const FROM_SCRATCH_SECTION_KEY = "__FROM_SCRATCH__";
const FROM_SCRATCH_SECTION_LABEL_KEY: TranslationKey = "feeMatrix.section.fromScratch";

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString(currentLocale(), {
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

function calculateVatExcludedHourlyRate(row: LicenseClassFeeRowResponse): number | null {
  return row.vatIncludedHourlyRate == null
    ? null
    : roundMoney(row.vatIncludedHourlyRate / (1 + VAT_RATE));
}

function calculateLessonFee(row: LicenseClassFeeRowResponse): number | null {
  return row.vatIncludedHourlyRate == null
    ? null
    : roundMoney(row.vatIncludedHourlyRate * row.lessonHours);
}

function calculateVatAmount(row: LicenseClassFeeRowResponse): number | null {
  const vatExcludedHourlyRate = calculateVatExcludedHourlyRate(row);
  return row.vatIncludedHourlyRate == null || vatExcludedHourlyRate == null
    ? null
    : roundMoney((row.vatIncludedHourlyRate - vatExcludedHourlyRate) * row.lessonHours);
}

function calculateLessonFeeVatExcluded(row: LicenseClassFeeRowResponse): number | null {
  const vatExcludedHourlyRate = calculateVatExcludedHourlyRate(row);
  return vatExcludedHourlyRate == null
    ? null
    : roundMoney(vatExcludedHourlyRate * row.lessonHours);
}

/** Sum a per-row calculation across both lesson rows (theory + practice) of
 *  a program, so the contract subtotals can be shown once in a merged cell. */
function sumByProgram(
  rows: LicenseClassFeeRowResponse[],
  programId: string,
  perRow: (row: LicenseClassFeeRowResponse) => number | null
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

function calculateContractTotal(row: LicenseClassFeeRowResponse): number | null {
  const lessonFeeVatExcluded = calculateLessonFeeVatExcluded(row);
  const vatAmount = calculateVatAmount(row);
  if (lessonFeeVatExcluded == null && vatAmount == null) return null;
  return roundMoney((lessonFeeVatExcluded ?? 0) + (vatAmount ?? 0));
}

function calculateContractTotalByProgram(
  rows: LicenseClassFeeRowResponse[],
  programId: string
): number | null {
  return sumByProgram(rows, programId, calculateContractTotal);
}

function rowKey(row: LicenseClassFeeRowResponse): string {
  return `${row.program.id}:${row.lessonType}`;
}

function hasRowEditableValue(row: LicenseClassFeeRowResponse): boolean {
  return ROW_EDITABLE_FIELDS.some((field) => readEditableValue(row, field.value) != null);
}

function toUpsertRow(row: LicenseClassFeeRowResponse): LicenseClassFeeRowUpsertRequest {
  const isTheory = row.lessonType === "theory";
  return {
    licenseClassDefinitionId: row.program.id,
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
export type FeeMatrixMode = ColumnGroup;
type Column = {
  key: string;
  labelKey: TranslationKey | "";
  /** Full, unabbreviated name shown as a hover tooltip when the visible label
   *  is shortened to fit the column width. */
  fullLabelKey?: TranslationKey;
  kind: ColumnKind;
  editableField?: EditableField;
  /** The cell renderer for non-editable columns. */
  render?: (
    row: LicenseClassFeeRowResponse,
    rows: LicenseClassFeeRowResponse[],
    t: ReturnType<typeof useT>,
  ) => React.ReactNode;
  /** Optional minimum cell width (px) to give the column some breathing room. */
  width?: number;
  /** When true, column header + cells stick to the left while scrolling. */
  sticky?: boolean;
  /** Collapsible group this column belongs to. Sticky info columns stay grouped as "—". */
  group?: ColumnGroup;
};

function renderSourceLicense(
  row: LicenseClassFeeRowResponse,
  _rows: LicenseClassFeeRowResponse[],
  t: ReturnType<typeof useT>,
): React.ReactNode {
  const isNone = row.program.sourceLicenseClass.toUpperCase() === "YOK";
  const displayName = isNone ? "-" : row.program.sourceLicenseDisplayName;
  return (
    <span
      className="fee-matrix-license-cell"
      title={`${displayName}${
        row.program.sourceLicensePre2016 ? ` ${t("feeMatrix.licenseBadge.pre2016")}` : ""
      } -> ${row.program.targetLicenseDisplayName}`}
    >
      <span className="fee-matrix-license-name">{displayName}</span>
      {row.program.sourceLicensePre2016 ? (
        <span className="fee-matrix-period-badge">2016</span>
      ) : null}
    </span>
  );
}

function compareLessonType(
  a: LicenseClassFeeRowResponse,
  b: LicenseClassFeeRowResponse
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
    column.key === "contractTotal" ||
    (column.editableField ? isProgramScopedField(column.editableField) : false)
  );
}

function isFirstProgramRow(
  rows: LicenseClassFeeRowResponse[],
  row: LicenseClassFeeRowResponse,
  index: number
): boolean {
  return index === 0 || rows[index - 1].program.id !== row.program.id;
}

function countProgramRows(
  rows: LicenseClassFeeRowResponse[],
  programId: string
): number {
  return rows.filter((row) => row.program.id === programId).length;
}

function isVisibleMatrixRow(row: LicenseClassFeeRowResponse): boolean {
  return row.lessonType !== "theory" || row.lessonHours > 0;
}

const COLUMNS: Column[] = [
  {
    // Bulk-selection toggle; rendered manually in the table body so it can
    // hook into selection state. The render here is just a placeholder.
    key: "select",
    labelKey: "",
    kind: "info",
    sticky: true,
    width: 44,
    render: () => null,
  },
  {
    key: "source",
    labelKey: "feeMatrix.col.source",
    kind: "info",
    sticky: true,
    width: 110,
    render: (row, rows, t) => renderSourceLicense(row, rows, t),
  },
  {
    key: "target",
    labelKey: "feeMatrix.col.target",
    kind: "info",
    sticky: true,
    width: 76,
    render: (row) => (
      <span className="fee-matrix-target-name">{row.program.targetLicenseDisplayName}</span>
    ),
  },
  {
    key: "lessonType",
    labelKey: "feeMatrix.col.lessonType",
    kind: "info",
    sticky: true,
    width: 70,
    render: (row, _rows, t) => (row.lessonType === "theory" ? t("feeMatrix.lessonType.theory") : t("feeMatrix.lessonType.practice")),
  },
  {
    key: "lessonHours",
    labelKey: "feeMatrix.col.lessonHours",
    fullLabelKey: "feeMatrix.col.lessonHoursFull",
    kind: "info",
    width: 56,
    render: (row) => row.lessonHours,
  },
  {
    key: "contractExamFee",
    labelKey: "feeMatrix.col.contractExamFee",
    fullLabelKey: "feeMatrix.col.contractExamFeeFull",
    kind: "editable",
    editableField: "contractExamFee",
    width: 88,
    group: "contract",
  },
  {
    key: "vatIncludedHourlyRate",
    labelKey: "feeMatrix.col.hourlyRateVat",
    fullLabelKey: "feeMatrix.col.hourlyRateVatFull",
    kind: "editable",
    editableField: "vatIncludedHourlyRate",
    width: 92,
    group: "contract",
  },
  {
    key: "vatExcludedHourlyRate",
    labelKey: "feeMatrix.col.hourlyRateNoVat",
    fullLabelKey: "feeMatrix.col.hourlyRateNoVatFull",
    kind: "calculated",
    width: 80,
    render: (row) => formatMoney(calculateVatExcludedHourlyRate(row)),
    group: "contract",
  },
  {
    key: "lessonFee",
    labelKey: "feeMatrix.col.lessonFee",
    fullLabelKey: "feeMatrix.col.lessonFeeFull",
    kind: "calculated",
    width: 84,
    render: (row) => formatMoney(calculateLessonFee(row)),
    group: "contract",
  },
  {
    key: "vatAmount",
    labelKey: "feeMatrix.col.vatAmount",
    fullLabelKey: "feeMatrix.col.vatAmountFull",
    kind: "calculated",
    width: 72,
    render: (row) => formatMoney(calculateVatAmount(row)),
    group: "contract",
  },
  {
    key: "contractTotalLessonFeeVatExcluded",
    labelKey: "feeMatrix.col.contractTotalNoVat",
    fullLabelKey: "feeMatrix.col.contractTotalNoVatFull",
    kind: "calculated",
    width: 104,
    render: (row, rows) =>
      formatMoney(sumByProgram(rows, row.program.id, calculateLessonFeeVatExcluded)),
    group: "contract",
  },
  {
    key: "contractTotalVat",
    labelKey: "feeMatrix.col.contractTotalVat",
    fullLabelKey: "feeMatrix.col.contractTotalVatFull",
    kind: "calculated",
    width: 96,
    render: (row, rows) =>
      formatMoney(sumByProgram(rows, row.program.id, calculateVatAmount)),
    group: "contract",
  },
  {
    key: "contractTotal",
    labelKey: "feeMatrix.col.contractTotal",
    fullLabelKey: "feeMatrix.col.contractTotalFull",
    kind: "calculated",
    width: 104,
    render: (row, rows) => formatMoney(calculateContractTotalByProgram(rows, row.program.id)),
    group: "contract",
  },
  {
    key: "institutionExamFee",
    labelKey: "feeMatrix.col.institutionExamFee",
    fullLabelKey: "feeMatrix.col.institutionExamFeeFull",
    kind: "editable",
    editableField: "institutionExamFee",
    width: 92,
    group: "institution",
  },
  {
    key: "courseFee",
    labelKey: "feeMatrix.col.courseFee",
    fullLabelKey: "feeMatrix.col.courseFeeFull",
    kind: "editable",
    editableField: "courseFee",
    width: 96,
    group: "institution",
  },
  {
    key: "mebbisFee",
    labelKey: "feeMatrix.col.mebbisFee",
    fullLabelKey: "feeMatrix.col.mebbisFeeFull",
    kind: "editable",
    editableField: "mebbisFee",
    width: 96,
    group: "institution",
  },
  {
    key: "failureRetryFee",
    labelKey: "feeMatrix.col.failureRetryFee",
    fullLabelKey: "feeMatrix.col.failureRetryFeeFull",
    kind: "editable",
    editableField: "failureRetryFee",
    width: 100,
    group: "institution",
  },
  {
    key: "privateLessonFee",
    labelKey: "feeMatrix.col.privateLessonFee",
    fullLabelKey: "feeMatrix.col.privateLessonFeeFull",
    kind: "editable",
    editableField: "privateLessonFee",
    width: 96,
    group: "institution",
  },
];

const MODE_TABS: { mode: FeeMatrixMode; labelKey: TranslationKey; to: string }[] = [
  {
    mode: "institution",
    labelKey: "feeMatrix.page.institution",
    to: "/settings/definitions/fees/institution",
  },
  {
    mode: "contract",
    labelKey: "feeMatrix.page.contract",
    to: "/settings/definitions/fees/contract",
  },
];

function columnsForMode(mode: FeeMatrixMode): Column[] {
  return COLUMNS.filter((column) => column.group == null || column.group === mode);
}

function editableFieldsForColumns(
  columns: readonly Column[]
): { value: EditableField; labelKey: TranslationKey }[] {
  const visibleFields = new Set(columns.map((column) => column.editableField).filter(Boolean));
  return EDITABLE_FIELDS.filter((field) => visibleFields.has(field.value));
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

function countDistinctPrograms(rows: LicenseClassFeeRowResponse[]): number {
  const ids = new Set<string>();
  for (const row of rows) ids.add(row.program.id);
  return ids.size;
}

/** A row counts as "dolu" only when every editable field on it has a value. */
function isRowFullyFilled(
  row: LicenseClassFeeRowResponse,
  fields: readonly { value: EditableField }[]
): boolean {
  return fields.every((field) => readEditableValue(row, field.value) != null);
}

function countFullyFilledRows(
  rows: LicenseClassFeeRowResponse[],
  fields: readonly { value: EditableField }[]
): number {
  return rows.reduce((acc, row) => (isRowFullyFilled(row, fields) ? acc + 1 : acc), 0);
}

/** Snapshot the editable fields of every row by key, so we can later
 *  detect which rows the user has touched since the last server sync. */
function snapshotEditableFields(
  rows: LicenseClassFeeRowResponse[]
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
 *  them together (a single LicenseClassYearFee row holds them all). */
function collectDirtyProgramFees(
  rows: LicenseClassFeeRowResponse[],
  baseline: Map<string, Partial<Record<EditableField, number | null>>>
): LicenseClassFeeProgramUpsertRequest[] {
  const result: LicenseClassFeeProgramUpsertRequest[] = [];
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
      licenseClassDefinitionId: row.program.id,
      ...currentByKey,
      rowVersion: row.program.yearFeeRowVersion,
    });
  }
  return result;
}

function isRowDirty(
  row: LicenseClassFeeRowResponse,
  baseline: Map<string, Partial<Record<EditableField, number | null>>>,
  fields: readonly { value: EditableField }[]
): boolean {
  const original = baseline.get(rowKey(row));
  if (!original) return fields.some((f) => readEditableValue(row, f.value) != null);
  for (const field of fields) {
    if ((original[field.value] ?? null) !== (readEditableValue(row, field.value) ?? null)) {
      return true;
    }
  }
  return false;
}

export function LicenseClassFeeMatrixSettingsSection({ mode }: { mode: FeeMatrixMode }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { user, permissions } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const canManagePayments = canManageArea(user, permissions, "payments");
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [year, setYear] = useState(CURRENT_YEAR);
  const [rows, setRows] = useState<LicenseClassFeeRowResponse[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedTargets, setExpandedTargets] = useState<Set<string>>(new Set());
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<string>>(new Set());
  /** Values currently typed into the inline bulk-apply row.
   *  Key is either the EditableField name (e.g. "courseFee") for single-slot
   *  fields, or "<field>.theory" / "<field>.practice" for split lesson
   *  columns where theory and practice need independent values. */
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  const baselineRef = useRef<Map<string, Partial<Record<EditableField, number | null>>>>(new Map());

  const visibleColumns = useMemo(() => columnsForMode(mode), [mode]);
  const visibleEditableFields = useMemo(
    () => editableFieldsForColumns(visibleColumns),
    [visibleColumns]
  );
  const stickyOffsets = useMemo(() => buildStickyOffsets(true), []);

  const toggleProgramSelection = (programId: string) => {
    setSelectedProgramIds((current) => {
      const next = new Set(current);
      if (next.has(programId)) next.delete(programId);
      else next.add(programId);
      return next;
    });
  };

  const clearProgramSelection = () => {
    setSelectedProgramIds(new Set());
    setBulkValues({});
  };

  const matrixQueryKey = useMemo(
    () => ["settings", "license-class-fee-matrix", year, refreshKey] as const,
    [refreshKey, year]
  );
  const matrixQuery = useQuery({
    gcTime: 60 * 60 * 1000,
    queryKey: matrixQueryKey,
    queryFn: ({ signal }) => getLicenseClassFeeMatrix(year, undefined, signal),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });
  const loading = matrixQuery.isLoading;
  const invalidateCandidateFeeMatrixCaches = () => {
    void queryClient.invalidateQueries({ queryKey: ["settings", "license-class-fee-matrix"] });
    void queryClient.invalidateQueries({ queryKey: ["finance", "license-class-fee-matrix"] });
    void queryClient.invalidateQueries({ queryKey: ["candidate-detail", "exam-attempt-fee-matrix"] });
    void queryClient.invalidateQueries({ queryKey: ["candidate-detail", "contract-back-fee-matrix"] });
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
    void queryClient.invalidateQueries({ queryKey: ["candidates", "accounting"] });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  useEffect(() => {
    if (!matrixQuery.data) return;
    setRows(matrixQuery.data.rows);
    baselineRef.current = snapshotEditableFields(matrixQuery.data.rows);
  }, [matrixQuery.data]);

  useEffect(() => {
    if (matrixQuery.isError) {
      showToast(t("feeMatrix.toast.loadFailed"), "error");
    }
  }, [matrixQuery.isError, showToast, t]);

  const sections = useMemo(() => {
    // Rows whose source license is "YOK" (candidates starting from scratch) are
    // collapsed into a single section instead of being scattered across every
    // target-license group. All other rows keep the target-based grouping.
    const map = new Map<string, LicenseClassFeeRowResponse[]>();
    for (const row of rows) {
      const isFromScratch =
        row.program.sourceLicenseClass.toUpperCase() === "YOK";
      const key = isFromScratch ? FROM_SCRATCH_SECTION_KEY : row.program.targetLicenseClass;
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      map.set(key, bucket);
    }

    const built = [...map.entries()].map(([target, sectionRows]) => ({
      target,
      rows: sectionRows.sort((a, b) => {
        // Inside the from-scratch section, order by the target license so the
        // list reads A1, A2, B, ... rather than by (constant) source name.
        if (target === FROM_SCRATCH_SECTION_KEY) {
          const targetCompare = a.program.targetLicenseDisplayName.localeCompare(
            b.program.targetLicenseDisplayName,
            "tr"
          );
          if (targetCompare !== 0) return targetCompare;
          return compareLessonType(a, b);
        }
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

    // From-scratch section pinned to the top.
    built.sort((a, b) => {
      if (a.target === FROM_SCRATCH_SECTION_KEY) return -1;
      if (b.target === FROM_SCRATCH_SECTION_KEY) return 1;
      return 0;
    });
    return built;
  }, [rows]);

  const allExpanded =
    sections.length > 0 && sections.every((section) => expandedTargets.has(section.target));

  const dirtyRowKeys = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (isRowDirty(row, baselineRef.current, visibleEditableFields)) set.add(rowKey(row));
    }
    return set;
  }, [rows, visibleEditableFields]);
  const allDirtyRowKeys = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (isRowDirty(row, baselineRef.current, EDITABLE_FIELDS)) set.add(rowKey(row));
    }
    return set;
  }, [rows]);
  const dirtyCount = allDirtyRowKeys.size;
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
    if (!canManagePayments) return;
    const parsed = parseAmount(value);
    if (isProgramScopedField(field)) {
      // Program-scoped fees live on the program, not the row. The clicked
      // cell identifies the program via its rowKey; mirror the new value
      // onto every row of that program so the UI stays consistent.
      const target = rows.find((r) => rowKey(r) === key);
      if (!target) return;
      const programId = target.program.id;
      const programPatch: Partial<LicenseClassFeeProgramResponse> = { [field]: parsed };
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

  const save = async () => {
    if (!canManagePayments) return;
    setSaving(true);
    try {
      const payloadRows = rows.filter((row) => row.id || hasRowEditableValue(row)).map(toUpsertRow);
      const payloadPrograms = collectDirtyProgramFees(rows, baselineRef.current);
      const response = await updateLicenseClassFeeMatrix(year, {
        rows: payloadRows,
        programs: payloadPrograms,
      });
      setRows(response.rows);
      baselineRef.current = snapshotEditableFields(response.rows);
      queryClient.setQueryData(matrixQueryKey, response);
      invalidateCandidateFeeMatrixCaches();
      showToast(t("feeMatrix.toast.saved"));
    } catch {
      showToast(t("feeMatrix.toast.saveFailed"), "error");
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
   *  selected program. For split lesson fields, `lessonType` picks which half
   *  receives the value; otherwise the call covers both halves (or the whole
   *  program-scoped fee). Returns whether the call ran so the caller can
   *  decide whether to clear the input. */
  const applyBulkField = async (
    field: EditableField,
    lessonType?: "theory" | "practice",
    valueOverride?: string
  ): Promise<boolean> => {
    if (!canManagePayments) return false;
    const key = bulkValueKey(field, lessonType);
    const parsed = parseAmount(valueOverride ?? bulkValues[key] ?? "");
    if (parsed == null) {
      showToast(t("feeMatrix.bulk.error.amountInvalid"), "error");
      return false;
    }
    const targetIds = Array.from(selectedProgramIds);
    if (targetIds.length === 0) {
      showToast(t("feeMatrix.bulk.error.noProgramSelected"), "error");
      return false;
    }

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
          lessonType: lessonType ?? null,
        },
      ];
    }

    setSaving(true);
    try {
      let lastResponse: { rows: LicenseClassFeeRowResponse[] } | null = null;
      let appliedProgramCount = 0;
      for (const expansion of expansions) {
        const expansionTargetIds = expansion.lessonType
          ? targetIds.filter((id) =>
              rows.some(
                (row) =>
                  row.program.id === id &&
                  row.lessonType === expansion.lessonType &&
                  isVisibleMatrixRow(row)
              )
            )
          : targetIds;
        if (expansionTargetIds.length === 0) {
          continue;
        }
        const payload: LicenseClassFeeBulkApplyRequest = {
          targetLicenseClass: null,
          licenseClassDefinitionIds: expansionTargetIds,
          lessonType: expansion.lessonType,
          field: expansion.backendField,
          value: parsed,
        };
        lastResponse = await bulkApplyLicenseClassFeeMatrix(year, payload);
        appliedProgramCount = Math.max(appliedProgramCount, expansionTargetIds.length);
      }
      if (!lastResponse) {
        showToast(t("feeMatrix.bulk.error.noRows"), "error");
        return false;
      }
      if (lastResponse) {
        setRows(lastResponse.rows);
        baselineRef.current = snapshotEditableFields(lastResponse.rows);
        queryClient.setQueryData(matrixQueryKey, lastResponse);
        invalidateCandidateFeeMatrixCaches();
      }
      const fieldLabel = (visibleEditableFields.find((f) => f.value === field) ? t(visibleEditableFields.find((f) => f.value === field)!.labelKey) : field);
      const lessonSuffix =
        lessonType === "theory" ? t("feeMatrix.bulk.appliedSuffix.theory") : lessonType === "practice" ? t("feeMatrix.bulk.appliedSuffix.practice") : "";
      showToast(t("feeMatrix.bulk.applied", { count: appliedProgramCount, field: fieldLabel, suffix: lessonSuffix }));
      setBulkValueFor(field, lessonType, "");
      return true;
    } catch {
      showToast(t("feeMatrix.bulk.error.failed"), "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  /** Visual-feedback helper for the bulk-row column highlight: does the
   *  user have a parseable amount typed for this column right now? Split
   *  lesson fields highlight if either of the two slots is filled. */
  const bulkColumnHasValue = (field: EditableField): boolean => {
    if (isDualLessonBulkField(field)) {
      return (
        parseAmount(bulkValues[bulkValueKey(field, "theory")] ?? "") != null ||
        parseAmount(bulkValues[bulkValueKey(field, "practice")] ?? "") != null
      );
    }
    return parseAmount(bulkValues[bulkValueKey(field)] ?? "") != null;
  };

  /** Apply every column whose bulk input has a parseable value. Split lesson
   *  fields contribute one job per filled side. Run sequentially so backend
   *  writes stay ordered and we don't race ourselves on RowVersion. */
  const applyAllBulkFields = async () => {
    if (!canManagePayments) return;
    const jobs: { field: EditableField; lessonType?: "theory" | "practice" }[] = [];
    for (const f of visibleEditableFields) {
      if (isDualLessonBulkField(f.value)) {
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
        if (canManagePayments && !saving && isDirty) save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManagePayments, saving, isDirty, year, rows]);

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
        <button className="btn btn-secondary fee-matrix-back-button" onClick={goBack} type="button">
          <span aria-hidden="true">←</span>
          <span>{t("feeMatrix.action.backToCallingPage")}</span>
        </button>
      </div>
      <section className="settings-surface fee-matrix">
        <div className="settings-surface-header">
          <div>
            <div className="settings-surface-title">
              {mode === "institution"
                ? t("feeMatrix.title.institution")
                : t("feeMatrix.title.contract")}
            </div>
            <div className="form-subsection-note">{t("feeMatrix.hint.editableNote", {
              editable: t("feeMatrix.hint.editableTag"),
              calculated: t("feeMatrix.hint.calculatedTag"),
            })}</div>
          </div>
          <div className="settings-module-actions fee-matrix-toolbar">
            <label className="fee-matrix-year-field">
                  <span>{t("feeMatrix.action.year")}</span>
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
                  {t("feeMatrix.action.refresh")}
                </button>
                {sections.length > 0 ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAllExpanded(!allExpanded)}
                    type="button"
                  >
                    {allExpanded ? t("feeMatrix.action.collapseAll") : t("feeMatrix.action.expandAll")}
                  </button>
                ) : null}
                {isDirty ? (
                  <span className="fee-matrix-dirty-badge" title={t("feeMatrix.action.unsavedChanges")}>
                    {t("feeMatrix.action.dirtyCount", { count: dirtyCount })}
                  </span>
                ) : null}
            <button
                className="btn btn-primary btn-sm"
                disabled={!canManagePayments || saving || !isDirty}
                onClick={save}
                title={
                  !canManagePayments
                    ? noPermissionTitle
                    : isDirty
                      ? t("feeMatrix.action.saveShortcut")
                      : t("feeMatrix.action.noChanges")
                }
                type="button"
              >
                {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>

        <div className="settings-surface-body fee-matrix-body">
          <nav aria-label={t("feeMatrix.tabs.aria")} className="fee-matrix-tabs">
            {MODE_TABS.map((tab) => (
              <NavLink
                className={({ isActive }) =>
                  isActive
                    ? "fee-matrix-tab is-active"
                    : "fee-matrix-tab"
                }
                key={tab.mode}
                state={location.state}
                to={tab.to}
              >
                {t(tab.labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="fee-matrix-bulk-hint" role="status">
              <span>
                {selectionCount > 0
                  ? t("feeMatrix.bulk.selected", { count: selectionCount })
                  : t("feeMatrix.bulk.hintSelect") + " "}
                {t("feeMatrix.bulk.hintMain")}
              </span>
              <div className="fee-matrix-bulk-hint-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={!canManagePayments || saving || selectionCount === 0}
                  onClick={clearProgramSelection}
                  title={!canManagePayments ? noPermissionTitle : undefined}
                  type="button"
                >
                  {t("feeMatrix.bulk.clear")}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={
                    !canManagePayments ||
                    saving ||
                    selectionCount === 0 ||
                    visibleEditableFields.every((f) => !bulkColumnHasValue(f.value))
                  }
                  onClick={applyAllBulkFields}
                  title={
                    !canManagePayments
                      ? noPermissionTitle
                      : t("feeMatrix.bulk.applyAllTitle")
                  }
                  type="button"
                >
                  {t("feeMatrix.bulk.applyAll")}
                </button>
              </div>
          </div>

          {loading ? (
            <div className="instructor-detail-empty">{t("feeMatrix.empty.loading")}</div>
          ) : sections.length === 0 ? (
            <div className="instructor-detail-empty">
              {t("feeMatrix.empty.noPrograms")}
            </div>
          ) : (
            <div className="fee-matrix-sections">
              {sections.map((section) => {
                const expanded = expandedTargets.has(section.target);
                const visibleSectionRows = section.rows.filter(isVisibleMatrixRow);
                const visibleLessonTypes = new Set(
                  visibleSectionRows.map((row) => row.lessonType)
                );
                const programCount = countDistinctPrograms(visibleSectionRows);
                const filledRows = countFullyFilledRows(visibleSectionRows, visibleEditableFields);
                const totalRows = visibleSectionRows.length;
                const sectionSelection = (() => {
                  const programIds = Array.from(
                    new Set(visibleSectionRows.map((r) => r.program.id))
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
                          {section.target === FROM_SCRATCH_SECTION_KEY
                            ? t(FROM_SCRATCH_SECTION_LABEL_KEY)
                            : t("feeMatrix.section.transitions", { target: section.target })}
                        </span>
                        <span className="fee-matrix-section-stats">
                          <span>{t("feeMatrix.section.programs", { count: programCount })}</span>
                          <span>{t("feeMatrix.section.rows", { count: visibleSectionRows.length })}</span>
                          <span
                            className={
                              filledRows === totalRows
                                ? "fee-matrix-section-stat--filled"
                                : filledRows === 0
                                ? "fee-matrix-section-stat--empty"
                                : "fee-matrix-section-stat--partial"
                            }
                          >
                            {t("feeMatrix.section.filledRows", { filled: filledRows, total: totalRows })}
                          </span>
                        </span>
                      </button>
                    </div>
                    {expanded ? (
                      <div className="fee-matrix-table-scroll">
                        <table className="data-table fee-matrix-table">
                          <thead>
                            <tr>
                              {visibleColumns.map((column) => {
                                const columnLabel = column.labelKey ? t(column.labelKey as TranslationKey) : "";
                                const tooltip = column.fullLabelKey ? t(column.fullLabelKey) : columnLabel;
                                const showTooltip = tooltip !== columnLabel;
                                return (
                                  <Fragment key={column.key}>
                                    <th
                                      className={`fee-matrix-th fee-matrix-th--${column.kind} fee-matrix-th--key-${column.key}${
                                        column.sticky ? " fee-matrix-th--sticky" : ""
                                      }${column.group ? ` fee-matrix-th--group-${column.group}` : ""}${
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
                                        <label className="fee-matrix-select-toggle switch-toggle">
                                          <input
                                            aria-label={t("feeMatrix.aria.selectAllInSection", {
                                              section: section.target === FROM_SCRATCH_SECTION_KEY
                                                ? t(FROM_SCRATCH_SECTION_LABEL_KEY)
                                                : section.target,
                                            })}
                                            checked={sectionSelection.allSelected}
                                            disabled={!canManagePayments}
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
                                          <span
                                            aria-hidden="true"
                                            className="switch-toggle-control"
                                            data-indeterminate={
                                              sectionSelection.someSelected &&
                                              !sectionSelection.allSelected
                                                ? "true"
                                                : undefined
                                            }
                                          />
                                        </label>
                                      ) : showTooltip ? (
                                        <ColumnHeaderLabel label={columnLabel} tooltip={tooltip} />
                                      ) : (
                                        columnLabel
                                      )}
                                    </th>
                                  </Fragment>
                                );
                              })}
                            </tr>
                            <tr className="fee-matrix-bulk-row">
                                {visibleColumns.map((column) => {
                                  const stickyLeft = column.sticky
                                    ? stickyOffsets.get(column.key)
                                    : undefined;
                                  const cellClass = `fee-matrix-th fee-matrix-bulk-cell fee-matrix-th--key-${column.key}${
                                    column.sticky ? " fee-matrix-th--sticky" : ""
                                  }${column.group ? ` fee-matrix-th--group-${column.group}` : ""}`;

                                  if (column.key === "select") {
                                    return (
                                      <th
                                        aria-hidden="true"
                                        className={`${cellClass} fee-matrix-bulk-cell--label`}
                                        key={column.key}
                                        style={{ minWidth: column.width, left: stickyLeft }}
                                      />
                                    );
                                  }
                                  if (column.key === "lessonType") {
                                    return (
                                      <th
                                        className={`${cellClass} fee-matrix-bulk-cell--lesson-types`}
                                        key={column.key}
                                        scope="row"
                                        style={{ minWidth: column.width, left: stickyLeft }}
                                      >
                                        <div className="fee-matrix-bulk-split-stack">
                                          {visibleLessonTypes.has("theory") ? <span>{t("feeMatrix.lessonType.theory")}</span> : null}
                                          {visibleLessonTypes.has("practice") ? <span>{t("feeMatrix.lessonType.practice")}</span> : null}
                                        </div>
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
                                    (visibleEditableFields.find((f) => f.value === field) ? t(visibleEditableFields.find((f) => f.value === field)!.labelKey) : field);
                                  if (isDualLessonBulkField(field)) {
                                    return (
                                      <th
                                        className={`${cellClass} fee-matrix-bulk-cell--split`}
                                        key={column.key}
                                        style={{ minWidth: column.width, left: stickyLeft }}
                                      >
                                        <div className="fee-matrix-bulk-split-stack">
                                          {(["theory", "practice"] as const)
                                            .filter((lessonType) => visibleLessonTypes.has(lessonType))
                                            .map((lessonType) => {
                                            const slotKey = bulkValueKey(field, lessonType);
                                            const slotLabel =
                                              lessonType === "theory" ? t("feeMatrix.bulk.theoryLabel") : t("feeMatrix.bulk.practiceLabel");
                                            const slotTitle =
                                              lessonType === "theory"
                                                ? t("feeMatrix.bulk.theoryTooltip", { label: fieldLabel })
                                                : t("feeMatrix.bulk.practiceTooltip", { label: fieldLabel });
                                            return (
                                              <input
                                                aria-label={t("feeMatrix.bulk.aria.value", {
                                                  label: fieldLabel,
                                                  lesson: lessonType === "theory" ? t("feeMatrix.lessonType.theory") : t("feeMatrix.lessonType.practice"),
                                                })}
                                                className="form-input fee-matrix-bulk-input fee-matrix-bulk-input--split"
                                                disabled={!canManagePayments || saving}
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
                                                    event.stopPropagation();
                                                    void applyBulkField(
                                                      field,
                                                      lessonType,
                                                      event.currentTarget.value
                                                    );
                                                  }
                                                }}
                                                placeholder={slotLabel}
                                                title={!canManagePayments ? noPermissionTitle : slotTitle}
                                                value={bulkValues[slotKey] ?? ""}
                                              />
                                            );
                                          })}
                                        </div>
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
                                        aria-label={t("feeMatrix.bulk.aria.value.single", { label: fieldLabel })}
                                        className="form-input fee-matrix-bulk-input"
                                        disabled={!canManagePayments || saving}
                                        inputMode="decimal"
                                        onChange={(event) =>
                                          setBulkValueFor(field, undefined, event.target.value)
                                        }
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter") {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            void applyBulkField(
                                              field,
                                              undefined,
                                              event.currentTarget.value
                                            );
                                          }
                                        }}
                                        placeholder="—"
                                        title={
                                          !canManagePayments
                                            ? noPermissionTitle
                                            : `${fieldLabel} için değer girip Enter'a basın`
                                        }
                                        value={value}
                                      />
                                    </th>
                                  );
                                })}
                            </tr>
                          </thead>
                          <tbody>
                            {visibleSectionRows.map((row, index) => {
                              const key = rowKey(row);
                              const firstProgramRow = isFirstProgramRow(
                                visibleSectionRows,
                                row,
                                index
                              );
                              const programRowSpan = firstProgramRow
                                ? countProgramRows(visibleSectionRows, row.program.id)
                                : 1;
                              const dirty = dirtyRowKeys.has(key);
                              return (
                                <tr className={dirty ? "is-dirty" : undefined} key={key}>
                                  {visibleColumns.map((column) => {
                                    if (isMergedProgramColumn(column) && !firstProgramRow) {
                                      return null;
                                    }

                                    return (
                                      <Fragment key={column.key}>
                                        <MatrixCell
                                          column={column}
                                          isBulkTarget={
                                            column.editableField !== undefined &&
                                            bulkColumnHasValue(column.editableField)
                                          }
                                          onToggleSelect={toggleProgramSelection}
                                          row={row}
                                          rowKeyValue={key}
                                          rowSpan={
                                            isMergedProgramColumn(column) ? programRowSpan : undefined
                                          }
                                          sectionRows={visibleSectionRows}
                                          selected={selectedProgramIds.has(row.program.id)}
                                          stickyOffsets={stickyOffsets}
                                          t={t}
                                          updateRow={updateRow}
                                          canManage={canManagePayments}
                                          noPermissionTitle={noPermissionTitle}
                                        />
                                      </Fragment>
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
  t,
  onToggleSelect,
  isBulkTarget,
  canManage,
  noPermissionTitle,
}: {
  column: Column;
  row: LicenseClassFeeRowResponse;
  rowKeyValue: string;
  rowSpan?: number;
  sectionRows: LicenseClassFeeRowResponse[];
  updateRow: (key: string, field: EditableField, value: string) => void;
  selected: boolean;
  stickyOffsets: Map<string, number>;
  t: ReturnType<typeof useT>;
  onToggleSelect: (programId: string) => void;
  isBulkTarget: boolean;
  canManage: boolean;
  noPermissionTitle: string;
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
        <label className="fee-matrix-select-toggle switch-toggle">
          <input
            aria-label={`${row.program.sourceLicenseDisplayName} → ${row.program.targetLicenseDisplayName} programını seç`}
            checked={selected}
            disabled={!canManage}
            onChange={() => onToggleSelect(row.program.id)}
            type="checkbox"
          />
          <span className="switch-toggle-control" aria-hidden="true" />
        </label>
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
          ariaLabel={column.labelKey ? t(column.labelKey as TranslationKey) : ""}
          disabled={!canManage}
          field={field}
          title={!canManage ? noPermissionTitle : undefined}
          row={row}
          rowKeyValue={rowKeyValue}
          updateRow={updateRow}
        />
      </td>
    );
  }

  return (
    <td className={baseClass} rowSpan={rowSpan} style={style}>
      {column.render?.(row, sectionRows, t)}
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
  title,
  updateRow,
}: {
  ariaLabel: string;
  disabled: boolean;
  field: EditableField;
  row: LicenseClassFeeRowResponse;
  rowKeyValue: string;
  title?: string;
  updateRow: (key: string, field: EditableField, value: string) => void;
}) {
  const externalValue = readEditableValue(row, field);
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
        title={title}
        value={serializeAmount(externalValue)}
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
      title={title}
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
