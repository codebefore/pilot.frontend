import { useEffect, useState } from "react";

import {
  AssignmentDateConflictError,
  createAssignment,
  updateAssignment,
} from "../../lib/instructor-assignments-api";
import {
  INSTRUCTOR_EMPLOYMENT_OPTIONS,
  INSTRUCTOR_ROLE_OPTIONS,
} from "../../lib/instructor-catalog";
import { useT } from "../../lib/i18n";
import type {
	  InstructorAssignment,
	  InstructorAssignmentUpsertRequest,
	  InstructorEmploymentType,
	  InstructorRole,
	  LicenseClass,
	  TrainingBranchDefinitionResponse,
} from "../../lib/types";
import { useLicenseClassOptions } from "../../lib/use-license-class-options";
import { CustomSelect } from "../ui/CustomSelect";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type Props = {
  open: boolean;
  instructorId: string;
  editing: InstructorAssignment | null;
  branches: TrainingBranchDefinitionResponse[];
  onClose: () => void;
  onSaved: (saved: InstructorAssignment) => void;
};

type FormState = {
  mebPermitNo: string;
  role: InstructorRole;
	  employmentType: InstructorEmploymentType;
	  weeklyLessonHours: string;
	  branches: string[];
	  licenseClassCodes: LicenseClass[];
	  contractStartDate: string;
	  contractEndDate: string;
};

function emptyState(): FormState {
  return {
    mebPermitNo: "",
    role: "master_instructor",
	    employmentType: "salaried",
	    weeklyLessonHours: "",
	    branches: [],
	    licenseClassCodes: [],
    contractStartDate: "",
    contractEndDate: "",
  };
}

function fromExisting(a: InstructorAssignment): FormState {
  return {
    mebPermitNo: a.mebPermitNo ?? "",
	    role: a.role,
	    employmentType: a.employmentType,
	    weeklyLessonHours: a.weeklyLessonHours != null ? String(a.weeklyLessonHours) : "",
    branches: a.branches,
	    licenseClassCodes: a.licenseClassCodes,
    contractStartDate: a.contractStartDate,
    contractEndDate: a.contractEndDate ?? "",
  };
}

export function InstructorAssignmentFormModal({
  open,
  instructorId,
  editing,
  branches,
  onClose,
  onSaved,
}: Props) {
	  const t = useT();
	  const { showToast } = useToast();
	  const { options: licenseClassOptions } = useLicenseClassOptions();
  const [values, setValues] = useState<FormState>(emptyState);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "_global", string>>>({});

	  useEffect(() => {
	    if (!open) return;
	    const branchCodes = new Set(branches.map((branch) => branch.code));
	    const licenseCodes = new Set(licenseClassOptions.map((option) => option.value));
	    const next = editing ? fromExisting(editing) : emptyState();
	    next.branches = next.branches.filter((branch) => branchCodes.has(branch));
	    next.licenseClassCodes = next.licenseClassCodes.filter((code) => licenseCodes.has(code));
	    setErrors({});
	    setValues(next);
	  }, [branches, editing, licenseClassOptions, open]);

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, _global: undefined }));
  };

	  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!values.contractStartDate) {
      next.contractStartDate = t("settings.instructors.detail.assignments.errors.startRequired");
    }
    if (
      values.contractEndDate &&
      values.contractStartDate &&
      values.contractEndDate < values.contractStartDate
    ) {
      next.contractEndDate = t("settings.instructors.detail.assignments.errors.endBeforeStart");
    }
	    if (values.weeklyLessonHours) {
      const n = Number(values.weeklyLessonHours);
      if (!Number.isFinite(n) || n < 0) {
        next.weeklyLessonHours = t("settings.instructors.detail.assignments.errors.weeklyHoursInvalid");
	      }
	    }
	    if (values.branches.length === 0) {
	      next.branches = "En az bir branş seçilmeli";
	    }
	    if (values.branches.includes("practice") && values.licenseClassCodes.length === 0) {
	      next.licenseClassCodes = "Uygulama branşı için en az bir ehliyet sınıfı seçilmeli";
	    }
	    setErrors(next);
    return Object.keys(next).length === 0;
	  };

	  const toggleBranch = (code: string, checked: boolean) => {
	    setValues((prev) => {
	      const branches = checked
	        ? prev.branches.includes(code) ? prev.branches : [...prev.branches, code]
	        : prev.branches.filter((item) => item !== code);
	      return {
	        ...prev,
	        branches,
	        licenseClassCodes: branches.includes("practice") ? prev.licenseClassCodes : [],
	      };
	    });
	    setErrors((prev) => ({ ...prev, branches: undefined, licenseClassCodes: undefined, _global: undefined }));
	  };

	  const toggleLicenseClass = (code: LicenseClass, checked: boolean) => {
	    setValues((prev) => ({
	      ...prev,
	      licenseClassCodes: checked
	        ? prev.licenseClassCodes.includes(code) ? prev.licenseClassCodes : [...prev.licenseClassCodes, code]
	        : prev.licenseClassCodes.filter((item) => item !== code),
	    }));
	    setErrors((prev) => ({ ...prev, licenseClassCodes: undefined, _global: undefined }));
	  };

	  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    const body: InstructorAssignmentUpsertRequest = {
      mebPermitNo: values.mebPermitNo.trim() || null,
      role: values.role,
	      employmentType: values.employmentType,
	      weeklyLessonHours: values.weeklyLessonHours ? Number(values.weeklyLessonHours) : null,
	      branches: values.branches,
	      licenseClassCodes: values.branches.includes("practice") ? values.licenseClassCodes : [],
      contractStartDate: values.contractStartDate,
	      contractEndDate: values.contractEndDate || null,
	      ...(editing ? { rowVersion: editing.rowVersion } : {}),
		  };

	    setSubmitting(true);
    try {
      const saved = editing
        ? await updateAssignment(instructorId, editing.id, body)
        : await createAssignment(instructorId, body);
      showToast(
        editing
          ? t("settings.instructors.detail.assignments.toasts.updated")
          : t("settings.instructors.detail.assignments.toasts.created")
      );
      onSaved(saved);
    } catch (err) {
      if (err instanceof AssignmentDateConflictError) {
        setErrors({
          _global: t("settings.instructors.detail.assignments.errors.dateOverlap"),
        });
      } else {
        showToast(t("settings.instructors.detail.assignments.errors.saveFailed"), "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={
        editing
          ? t("settings.instructors.detail.assignments.modal.editTitle")
          : t("settings.instructors.detail.assignments.modal.createTitle")
      }
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" disabled={submitting} onClick={onClose} type="button">
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={submitting} onClick={submit} type="button">
            {submitting ? t("common.saving") : t("common.save")}
          </button>
        </>
      }
    >
      <form className="settings-form" onSubmit={submit}>
        {errors._global && <div className="form-error form-error-banner">{errors._global}</div>}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              {t("settings.instructors.detail.assignments.field.role")}
            </label>
            <CustomSelect
              className="form-select"
              onChange={(e) => set("role", e.target.value as InstructorRole)}
              value={values.role}
            >
              {INSTRUCTOR_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div className="form-group">
            <label className="form-label">
              {t("settings.instructors.detail.assignments.field.employmentType")}
            </label>
            <CustomSelect
              className="form-select"
              onChange={(e) => set("employmentType", e.target.value as InstructorEmploymentType)}
              value={values.employmentType}
            >
              {INSTRUCTOR_EMPLOYMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </CustomSelect>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              {t("settings.instructors.detail.assignments.field.branch")}
            </label>
	            <div className="settings-checkbox-list">
	              {branches.map((b) => (
	                <label className="switch-toggle" key={b.id}>
	                  <input
	                    checked={values.branches.includes(b.code)}
	                    onChange={(event) => toggleBranch(b.code, event.target.checked)}
	                    type="checkbox"
	                  />
	                  <span className="switch-toggle-control" aria-hidden="true" />
	                  <span>{b.name}</span>
	                </label>
		              ))}
		            </div>
		            {errors.branches && (
		              <div className="form-error">{errors.branches}</div>
		            )}
		          </div>
          <div className="form-group">
            <label className="form-label">
              {t("settings.instructors.detail.assignments.field.weeklyLessonHours")}
            </label>
            <input
              className="form-input"
              inputMode="numeric"
              onChange={(e) => set("weeklyLessonHours", e.target.value)}
              type="number"
              min={0}
              value={values.weeklyLessonHours}
            />
            {errors.weeklyLessonHours && (
              <div className="form-error">{errors.weeklyLessonHours}</div>
            )}
	        </div>

	        {values.branches.includes("practice") ? (
	          <div className="form-row">
	            <div className="form-group">
	              <label className="form-label">Ehliyet Tipleri</label>
	              <div className="settings-checkbox-list">
	                {licenseClassOptions.map((option) => (
	                  <label className="switch-toggle" key={option.value}>
	                    <input
	                      checked={values.licenseClassCodes.includes(option.value)}
	                      onChange={(event) => toggleLicenseClass(option.value, event.target.checked)}
	                      type="checkbox"
	                    />
	                    <span className="switch-toggle-control" aria-hidden="true" />
	                    <span>{option.label}</span>
	                  </label>
	                ))}
	              </div>
	              {errors.licenseClassCodes && (
	                <div className="form-error">{errors.licenseClassCodes}</div>
	              )}
	            </div>
	          </div>
	        ) : null}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              {t("settings.instructors.detail.assignments.field.mebPermitNo")}
            </label>
            <input
              className="form-input"
              onChange={(e) => set("mebPermitNo", e.target.value)}
              type="text"
              value={values.mebPermitNo}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              {t("settings.instructors.detail.assignments.field.contractStart")}
            </label>
            <LocalizedDateInput
              ariaLabel={t("settings.instructors.detail.assignments.field.contractStart")}
              className="form-input"
              lang="tr"
              onChange={(value) => set("contractStartDate", value)}
              value={values.contractStartDate}
            />
            {errors.contractStartDate && (
              <div className="form-error">{errors.contractStartDate}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">
              {t("settings.instructors.detail.assignments.field.contractEnd")}
            </label>
            <LocalizedDateInput
              ariaLabel={t("settings.instructors.detail.assignments.field.contractEnd")}
              className="form-input"
              lang="tr"
              onChange={(value) => set("contractEndDate", value)}
              value={values.contractEndDate}
            />
            {errors.contractEndDate && (
              <div className="form-error">{errors.contractEndDate}</div>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
