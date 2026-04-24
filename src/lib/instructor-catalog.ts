import type {
  InstructorBranch,
  InstructorEmploymentType,
  InstructorRole,
} from "./types";
import { REFERENCE_LICENSE_CLASS_OPTIONS } from "./use-license-class-options";

type Option<T extends string> = {
  value: T;
  label: string;
};

export const INSTRUCTOR_ROLE_OPTIONS: Option<InstructorRole>[] = [
  { value: "founder", label: "Kurucu" },
  { value: "manager", label: "Müdür" },
  { value: "assistant_manager", label: "Müdür Yardımcısı" },
  { value: "master_instructor", label: "Usta Öğretici" },
  { value: "specialist_instructor", label: "Uzman Öğretici" },
  { value: "psychologist", label: "Psikolog" },
  { value: "office_staff", label: "Büro Personeli" },
  { value: "track_responsible", label: "Pist Sorumlusu" },
  { value: "accounting", label: "Muhasebe" },
  { value: "other", label: "Diğer" },
];

export const INSTRUCTOR_EMPLOYMENT_OPTIONS: Option<InstructorEmploymentType>[] = [
  { value: "salaried", label: "Kadrolu" },
  { value: "hourly", label: "Ders Saat Ücretli" },
  { value: "other", label: "Diğer Personel" },
];

export const INSTRUCTOR_BRANCH_OPTIONS: Option<InstructorBranch>[] = [
  { value: "traffic", label: "Trafik ve Çevre" },
  { value: "first_aid", label: "İlk Yardım" },
  { value: "vehicle_technique", label: "Araç Tekniği" },
  { value: "traffic_ethics", label: "Trafik Adabı" },
  { value: "practice", label: "Uygulama" },
];

export const INSTRUCTOR_LICENSE_CLASS_OPTIONS = [...REFERENCE_LICENSE_CLASS_OPTIONS];

function buildLabelMap<T extends string>(options: Option<T>[]): Record<T, string> {
  return options.reduce(
    (acc, option) => ({ ...acc, [option.value]: option.label }),
    {} as Record<T, string>
  );
}

export const INSTRUCTOR_ROLE_LABELS = buildLabelMap(INSTRUCTOR_ROLE_OPTIONS);
export const INSTRUCTOR_EMPLOYMENT_LABELS = buildLabelMap(INSTRUCTOR_EMPLOYMENT_OPTIONS);
export const INSTRUCTOR_BRANCH_LABELS = buildLabelMap(INSTRUCTOR_BRANCH_OPTIONS);
