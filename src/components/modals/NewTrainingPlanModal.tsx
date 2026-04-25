import { useEffect } from "react";
import { useForm } from "react-hook-form";

import type {
  AreaResponse,
  CandidateResponse,
  GroupResponse,
  InstructorResponse,
  RouteResponse,
  TrainingLessonKind,
  TrainingLessonStatus,
  VehicleResponse,
} from "../../lib/types";
import { Modal } from "../ui/Modal";
import { CustomSelect } from "../ui/CustomSelect";

type PlanType = TrainingLessonKind;

export type TrainingLessonSubmitValues = {
  type: PlanType;
  status: TrainingLessonStatus;
  date: string;
  startTime: string;
  durationMinutes: number;
  instructorId: string;
  groupId?: string;
  candidateId?: string;
  vehicleId?: string;
  areaId?: string;
  routeId?: string;
  notes?: string;
};

type NewTrainingPlanModalProps = {
  open: boolean;
  defaultType?: PlanType;
  initialSlot?: { start: Date; end: Date } | null;
  instructors: InstructorResponse[];
  groups: GroupResponse[];
  candidates: CandidateResponse[];
  vehicles: VehicleResponse[];
  areas: AreaResponse[];
  routes: RouteResponse[];
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
    candidateId: "",
    vehicleId: "",
    areaId: "",
    routeId: "",
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
  candidates,
  vehicles,
  areas,
  routes,
  onClose,
  onSubmit,
  serverFieldErrors,
  serverGeneralError,
}: NewTrainingPlanModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TrainingLessonSubmitValues>({
    defaultValues: buildDefaultValues(defaultType, initialSlot),
  });

  useEffect(() => {
    if (open) reset(buildDefaultValues(defaultType, initialSlot));
  }, [defaultType, initialSlot, open, reset]);

  const type = watch("type");
  const needsPracticeFields = type === "uygulama";

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
            İptal
          </button>
          <button className="btn btn-primary" onClick={submit} type="button">
            Kaydet
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={type === "teorik" ? "Yeni Teorik Ders" : "Yeni Uygulama Dersi"}
    >
      <form onSubmit={submit}>
        {serverGeneralError ? (
          <div className="form-error" style={{ marginBottom: 12 }}>
            {serverGeneralError}
          </div>
        ) : null}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Plan Tipi</label>
            <CustomSelect className="form-select" {...register("type", { required: true })}>
              <option value="teorik">Teorik</option>
              <option value="uygulama">Uygulama</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <label className="form-label">Durum</label>
            <CustomSelect className="form-select" {...register("status", { required: true })}>
              <option value="planned">Planlandı</option>
              <option value="completed">Tamamlandı</option>
            </CustomSelect>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tarih</label>
            <input
              className={fieldClass("date", !!errors.date, "form-input")}
              type="date"
              {...register("date", { required: "Tarih zorunlu" })}
            />
            {errors.date && <div className="form-error">{errors.date.message}</div>}
            {!errors.date && serverErr("date") ? (
              <div className="form-error">{serverErr("date")}</div>
            ) : null}
          </div>
          <div className="form-group">
            <label className="form-label">Başlangıç</label>
            <input
              className={fieldClass("startTime", !!errors.startTime, "form-input")}
              type="time"
              {...register("startTime", { required: "Saat zorunlu" })}
            />
            {errors.startTime && (
              <div className="form-error">{errors.startTime.message}</div>
            )}
            {!errors.startTime && serverErr("startTime") ? (
              <div className="form-error">{serverErr("startTime")}</div>
            ) : null}
          </div>
          <div className="form-group">
            <label className="form-label">Süre</label>
            <CustomSelect
              className={fieldClass("durationMinutes", false, "form-select")}
              {...register("durationMinutes", {
                required: "Süre zorunlu",
                valueAsNumber: true,
              })}
            >
              {/* Min 1 saat. Backend süre < 60 dk'yı 400 ile reddeder. */}
              <option value={60}>1 saat</option>
              <option value={90}>1.5 saat</option>
              <option value={120}>2 saat</option>
              <option value={180}>3 saat</option>
              <option value={240}>4 saat</option>
            </CustomSelect>
            {serverErr("durationMinutes") ? (
              <div className="form-error">{serverErr("durationMinutes")}</div>
            ) : null}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Eğitmen</label>
            <CustomSelect
              className={fieldClass("instructorId", !!errors.instructorId, "form-select")}
              {...register("instructorId", { required: "Eğitmen zorunlu" })}
            >
              <option value="">Seçiniz</option>
              {instructors.map((instructor) => (
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
              <label className="form-label">Grup</label>
              <CustomSelect
                className={fieldClass("groupId", !!errors.groupId, "form-select")}
                {...register("groupId", {
                  validate: (value) =>
                    type !== "teorik" || value ? true : "Grup zorunlu",
                })}
              >
                <option value="">Seçiniz</option>
                {groups.map((group) => (
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
              <label className="form-label">Aday</label>
              <CustomSelect
                className={fieldClass("candidateId", !!errors.candidateId, "form-select")}
                {...register("candidateId", {
                  validate: (value) =>
                    !needsPracticeFields || value ? true : "Aday zorunlu",
                })}
              >
                <option value="">Seçiniz</option>
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

        {needsPracticeFields ? (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Araç</label>
              <CustomSelect
                className={fieldClass("vehicleId", !!errors.vehicleId, "form-select")}
                {...register("vehicleId", {
                  validate: (value) =>
                    !needsPracticeFields || value ? true : "Araç zorunlu",
                })}
              >
                <option value="">Seçiniz</option>
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
            <div className="form-group">
              <label className="form-label">Güzergah</label>
              <CustomSelect className="form-select" {...register("routeId")}>
                <option value="">Seçim yok</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </CustomSelect>
            </div>
          </div>
        ) : (
          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Alan / Sınıf</label>
              <CustomSelect className="form-select" {...register("areaId")}>
                <option value="">Seçim yok</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </CustomSelect>
            </div>
          </div>
        )}

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Not</label>
            <textarea className="form-textarea" rows={3} {...register("notes")} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
