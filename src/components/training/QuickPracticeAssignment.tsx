import { useT } from "../../lib/i18n";
import type {
  CandidateResponse,
  InstructorResponse,
  VehicleResponse,
} from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";

type QuickPracticeAssignmentProps = {
  candidates: CandidateResponse[];
  instructors: InstructorResponse[];
  vehicles: VehicleResponse[];
  /** Takvimden seçilen slot — başlangıç saati panel'de gösterilir. */
  selectedSlot: { start: Date; end: Date } | null;
  /** Controlled: parent kontrol eder. */
  candidateId: string;
  instructorId: string;
  vehicleId: string;
  /** Seçim değişikliğini parent'a (TrainingPage) iletiyor. */
  onSettingsChange: (params: {
    candidateId: string;
    instructorId: string;
    vehicleId: string;
  }) => void;
  isLoading?: boolean;
};

export function QuickPracticeAssignment({
  candidates,
  instructors,
  vehicles,
  selectedSlot,
  candidateId,
  instructorId,
  vehicleId,
  onSettingsChange,
  isLoading = false,
}: QuickPracticeAssignmentProps) {
  const t = useT();
  const slotTime = selectedSlot
    ? selectedSlot.start.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Seçili adayın ehliyet sınıfı, araç filtresinde önceliklidir — yanlış
  // sınıfta bir araçla atama yapılırsa backend zaten reddeder.
  const selectedCandidate = candidates.find((c) => c.id === candidateId);

  return (
    <div className="training-quick-assign">
      <div className="training-quick-assign-header">
        <span>{t("training.quick.header")}</span>
        {slotTime ? (
          <span className="training-quick-assign-slot">{slotTime}</span>
        ) : null}
      </div>

      <div className="form-group">
        <CustomSelect
          className="form-select"
          disabled={isLoading}
          onChange={(e) =>
            onSettingsChange({
              candidateId: e.target.value,
              instructorId,
              vehicleId,
            })
          }
          value={candidateId}
        >
          <option value="">{t("training.quick.candidatePlaceholder")}</option>
          {candidates
            .filter((c) => c.status === "active")
            .sort((a, b) =>
              `${a.firstName} ${a.lastName}`.localeCompare(
                `${b.firstName} ${b.lastName}`,
                "tr"
              )
            )
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} ({c.licenseClass})
              </option>
            ))}
        </CustomSelect>
      </div>

      <div className="form-group">
        <CustomSelect
          className="form-select"
          disabled={isLoading}
          onChange={(e) =>
            onSettingsChange({
              candidateId,
              instructorId: e.target.value,
              vehicleId,
            })
          }
          value={instructorId}
        >
          <option value="">{t("training.quick.instructorPlaceholder")}</option>
          {/* Sadece uygulama (`practice`) branş'ı olan eğitmenler. */}
          {instructors
            .filter((inst) => inst.branches.includes("practice"))
            .sort((a, b) => a.firstName.localeCompare(b.firstName, "tr"))
            .map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.firstName} {inst.lastName}
              </option>
            ))}
        </CustomSelect>
      </div>

      <div className="form-group">
        <CustomSelect
          className="form-select"
          disabled={isLoading}
          onChange={(e) =>
            onSettingsChange({
              candidateId,
              instructorId,
              vehicleId: e.target.value,
            })
          }
          value={vehicleId}
        >
          <option value="">{t("training.quick.vehiclePlaceholder")}</option>
          {vehicles
            .filter((v) => v.isActive)
            .filter((v) =>
              selectedCandidate
                ? v.licenseClass === selectedCandidate.licenseClass
                : true
            )
            .sort((a, b) => a.plateNumber.localeCompare(b.plateNumber, "tr"))
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.plateNumber} — {v.brand}
                {v.model ? ` ${v.model}` : ""}
              </option>
            ))}
        </CustomSelect>
      </div>
    </div>
  );
}
