import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { useT } from "../../lib/i18n";
import type {
	  CandidateResponse,
	  GroupResponse,
	  InstructorResponse,
	  TrainingBranchDefinitionResponse,
	  TrainingLessonKind,
	  TrainingLessonStatus,
	  VehicleResponse,
} from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { LocalizedTimeInput } from "../ui/LocalizedTimeInput";
import { Modal } from "../ui/Modal";

type PlanType = TrainingLessonKind;

export type TrainingLessonSubmitValues = {
  type: PlanType;
  status: TrainingLessonStatus;
  date: string;
  startTime: string;
  durationMinutes: number;
	  instructorId: string;
	  groupId?: string;
	  branchCode?: string;
	  candidateId?: string;
  vehicleId?: string;
  notes?: string;
};

type NewTrainingPlanModalProps = {
  open: boolean;
  defaultType?: PlanType;
  initialSlot?: { start: Date; end: Date } | null;
  instructors: InstructorResponse[];
	  groups: GroupResponse[];
	  branches: TrainingBranchDefinitionResponse[];
	  candidates: CandidateResponse[];
  vehicles: VehicleResponse[];
  onClose: () => void;
  onSubmit: (values: TrainingLessonSubmitValues) => void;
  /** Backend `errorCodes` -> çevrilmiş mesaj. Parent submit hatasında
   *  bu map'i set eder; modal açık kalır ve inline gösterir. */
  serverFieldErrors?: Record<string, string>;
  /** Field eşleşmesi olmayan genel hata (örn. concurrency). */
  serverGeneralError?: string;
};

const pad = (value: number) => String(value).padStart(2, "0");

const formatDateInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatTimeInput = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

// Min ders 60 dk; slot uzunluğu 30 dk'lık katlara yuvarlanır.
const slotDurationFromRange = (slot: { start: Date; end: Date } | null) => {
  if (!slot) return null;
  const diff = Math.round((slot.end.getTime() - slot.start.getTime()) / 60000);
  if (diff <= 0) return null;
  const snapped = Math.round(diff / 30) * 30;
  return Math.max(60, snapped);
};

const buildDefaultValues = (
  type: PlanType,
  slot?: { start: Date; end: Date } | null
): TrainingLessonSubmitValues => {
  const start = slot?.start ?? new Date();
  const normalizedStart = new Date(start);
  if (!slot) {
    normalizedStart.setHours(type === "teorik" ? 9 : 10, 0, 0, 0);
  }

  // Default: 60 dk (min). Slot daha uzun seçildiyse 30 dk'lık katlara
  // yuvarlanmış halini kullan.
  const durationMinutes = slotDurationFromRange(slot ?? null) ?? 60;

  return {
    type,
    status: "planned",
    date: formatDateInput(normalizedStart),
    startTime: formatTimeInput(normalizedStart),
    durationMinutes,
	    instructorId: "",
	    groupId: "",
	    branchCode: "",
    candidateId: "",
    vehicleId: "",
    notes: "",
  };
};

const candidateLabel = (candidate: CandidateResponse) =>
  `${candidate.firstName} ${candidate.lastName} — ${candidate.licenseClass}`;

const vehicleLabel = (vehicle: VehicleResponse) =>
  `${vehicle.plateNumber} — ${vehicle.brand}${vehicle.model ? ` ${vehicle.model}` : ""}`;

const instructorLabel = (instructor: InstructorResponse) =>
  `${instructor.firstName} ${instructor.lastName}`;

export function NewTrainingPlanModal({
  open,
  defaultType = "teorik",
  initialSlot = null,
	  instructors,
	  groups,
	  branches,
  candidates,
  vehicles,
  onClose,
  onSubmit,
  serverFieldErrors,
  serverGeneralError,
}: NewTrainingPlanModalProps) {
  const t = useT();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TrainingLessonSubmitValues>({
    defaultValues: buildDefaultValues(defaultType, initialSlot),
  });

  useEffect(() => {
    if (open) reset(buildDefaultValues(defaultType, initialSlot));
  }, [defaultType, initialSlot, open, reset]);

  const type = watch("type");
  const date = watch("date");
  const startTime = watch("startTime");
  const needsPracticeFields = type === "uygulama";
  const dateRegistration = register("date", { required: t("training.modal.required.date") });
  const startTimeRegistration = register("startTime", {
    required: t("training.modal.required.time"),
  });

  const submit = handleSubmit((values) => onSubmit(values));

  // Server hatası varsa input vurgusu da yansısın.
  const serverErr = (field: string) => serverFieldErrors?.[field];
  const fieldClass = (
    field: string,
    hasError: boolean,
    base: "form-input" | "form-select"
  ) => (hasError || serverErr(field) ? `${base} error` : base);

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            {t("training.modal.cancel")}
          </button>
          <button className="btn btn-primary" onClick={submit} type="button">
            {t("training.modal.save")}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={
        type === "teorik"
          ? t("training.modal.newTheory")
          : t("training.modal.newPractice")
      }
    >
      <form onSubmit={submit}>
        {serverGeneralError ? (
          <div className="form-error" style={{ marginBottom: 12 }}>
            {serverGeneralError}
          </div>
        ) : null}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("training.modal.field.planType")}</label>
            <CustomSelect className="form-select" {...register("type", { required: true })}>
              <option value="teorik">{t("training.modal.kindTheory")}</option>
              <option value="uygulama">{t("training.modal.kindPractice")}</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <label className="form-label">{t("training.modal.field.status")}</label>
            <CustomSelect className="form-select" {...register("status", { required: true })}>
              <option value="planned">{t("training.modal.statusPlanned")}</option>
              <option value="completed">{t("training.modal.statusCompleted")}</option>
            </CustomSelect>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("training.modal.field.date")}</label>
            <LocalizedDateInput
              className={fieldClass("date", !!errors.date, "form-input")}
              inputRef={dateRegistration.ref}
              name={dateRegistration.name}
              onBlur={dateRegistration.onBlur}
              onChange={(value) =>
                setValue("date", value, { shouldDirty: true, shouldValidate: true })
              }
              value={date}
            />
            {errors.date && <div className="form-error">{errors.date.message}</div>}
            {!errors.date && serverErr("date") ? (
              <div className="form-error">{serverErr("date")}</div>
            ) : null}
          </div>
          <div className="form-group">
            <label className="form-label">{t("training.modal.field.startTime")}</label>
            <LocalizedTimeInput
              className={fieldClass("startTime", !!errors.startTime, "form-input")}
              inputRef={startTimeRegistration.ref}
              name={startTimeRegistration.name}
              onBlur={startTimeRegistration.onBlur}
              onChange={(value) =>
                setValue("startTime", value, { shouldDirty: true, shouldValidate: true })
              }
              value={startTime}
            />
            {errors.startTime && (
              <div className="form-error">{errors.startTime.message}</div>
            )}
            {!errors.startTime && serverErr("startTime") ? (
              <div className="form-error">{serverErr("startTime")}</div>
            ) : null}
          </div>
          <div className="form-group">
            <label className="form-label">{t("training.modal.field.duration")}</label>
            <CustomSelect
              className={fieldClass("durationMinutes", false, "form-select")}
              {...register("durationMinutes", {
                required: t("training.modal.required.duration"),
                valueAsNumber: true,
              })}
            >
              {/* Min 1 saat. Backend süre < 60 dk'yı 400 ile reddeder. */}
              <option value={60}>{t("training.modal.duration.h1")}</option>
              <option value={90}>{t("training.modal.duration.h1_5")}</option>
              <option value={120}>{t("training.modal.duration.h2")}</option>
              <option value={180}>{t("training.modal.duration.h3")}</option>
              <option value={240}>{t("training.modal.duration.h4")}</option>
            </CustomSelect>
            {serverErr("durationMinutes") ? (
              <div className="form-error">{serverErr("durationMinutes")}</div>
            ) : null}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("training.modal.field.instructor")}</label>
            <CustomSelect
              className={fieldClass("instructorId", !!errors.instructorId, "form-select")}
              {...register("instructorId", { required: t("training.modal.required.instructor") })}
            >
              <option value="">{t("training.modal.placeholder.select")}</option>
              {/* Eğitmen filtresi tip'e göre: teorik → en az bir teorik
                  branş; uygulama → `practice` branşı olmalı. */}
              {instructors
                .filter((instructor) =>
                  type === "teorik"
                    ? instructor.branches.some((b) => b !== "practice")
                    : instructor.branches.includes("practice")
                )
                .map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructorLabel(instructor)}
                  </option>
                ))}
            </CustomSelect>
            {errors.instructorId && (
              <div className="form-error">{errors.instructorId.message}</div>
            )}
            {!errors.instructorId && serverErr("instructorId") ? (
              <div className="form-error">{serverErr("instructorId")}</div>
            ) : null}
          </div>
	          {type === "teorik" ? (
	            <div className="form-group">
              <label className="form-label">{t("training.modal.field.group")}</label>
              <CustomSelect
                className={fieldClass("groupId", !!errors.groupId, "form-select")}
                {...register("groupId", {
                  validate: (value) =>
                    type !== "teorik" || value ? true : t("training.modal.required.group"),
                })}
              >
                <option value="">{t("training.modal.placeholder.select")}</option>
                {/* Aktif aday'ı 0 olan grupları gizle — ders atanacak
                    öğrenci yok (assignedCandidateCount kontenjan sayacı). */}
                {groups
                  .filter((g) => g.activeCandidateCount > 0)
                  .map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.title}
                    </option>
                  ))}
              </CustomSelect>
              {errors.groupId && (
                <div className="form-error">{errors.groupId.message}</div>
              )}
              {!errors.groupId && serverErr("groupId") ? (
                <div className="form-error">{serverErr("groupId")}</div>
              ) : null}
	            </div>
	          ) : (
            <div className="form-group">
              <label className="form-label">{t("training.modal.field.candidate")}</label>
              <CustomSelect
                className={fieldClass("candidateId", !!errors.candidateId, "form-select")}
                {...register("candidateId", {
                  validate: (value) =>
                    !needsPracticeFields || value ? true : t("training.modal.required.candidate"),
                })}
              >
                <option value="">{t("training.modal.placeholder.select")}</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidateLabel(candidate)}
                  </option>
                ))}
              </CustomSelect>
              {errors.candidateId && (
                <div className="form-error">{errors.candidateId.message}</div>
              )}
              {!errors.candidateId && serverErr("candidateId") ? (
                <div className="form-error">{serverErr("candidateId")}</div>
              ) : null}
            </div>
	          )}
	        </div>

	        {type === "teorik" ? (
	          <div className="form-row">
	            <div className="form-group">
	              <label className="form-label">{t("training.modal.field.branch")}</label>
	              <CustomSelect
	                className={fieldClass("branchCode", !!errors.branchCode, "form-select")}
	                {...register("branchCode", {
	                  validate: (value) =>
	                    type !== "teorik" || value ? true : t("training.modal.required.branch"),
	                })}
	              >
	                <option value="">{t("training.modal.placeholder.select")}</option>
	                {branches
	                  .filter((branch) => branch.isActive)
	                  .map((branch) => (
	                    <option key={branch.id} value={branch.code}>
	                      {branch.name}
	                    </option>
	                  ))}
	              </CustomSelect>
	              {errors.branchCode && (
	                <div className="form-error">{errors.branchCode.message}</div>
	              )}
	              {!errors.branchCode && serverErr("branchCode") ? (
	                <div className="form-error">{serverErr("branchCode")}</div>
	              ) : null}
	            </div>
          </div>
        ) : null}

        {needsPracticeFields ? (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t("training.modal.field.vehicle")}</label>
              <CustomSelect
                className={fieldClass("vehicleId", !!errors.vehicleId, "form-select")}
                {...register("vehicleId", {
                  validate: (value) =>
                    !needsPracticeFields || value ? true : t("training.modal.required.vehicle"),
                })}
              >
                <option value="">{t("training.modal.placeholder.select")}</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicleLabel(vehicle)}
                  </option>
                ))}
              </CustomSelect>
              {errors.vehicleId && (
                <div className="form-error">{errors.vehicleId.message}</div>
              )}
              {!errors.vehicleId && serverErr("vehicleId") ? (
                <div className="form-error">{serverErr("vehicleId")}</div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("training.modal.field.notes")}</label>
            <textarea className="form-textarea" rows={3} {...register("notes")} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
