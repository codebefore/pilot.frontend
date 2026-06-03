import type {
  InstructorEmploymentType,
  InstructorRole,
} from "./types";
import type { TranslationKey } from "./i18n";

type Option<T extends string> = {
  value: T;
  labelKey: TranslationKey;
};

export const INSTRUCTOR_ROLE_OPTIONS: Option<InstructorRole>[] = [
  { value: "founder", labelKey: "instructor.role.founder" },
  { value: "manager", labelKey: "instructor.role.manager" },
  { value: "assistant_manager", labelKey: "instructor.role.assistantManager" },
  { value: "master_instructor", labelKey: "instructor.role.masterInstructor" },
  { value: "specialist_instructor", labelKey: "instructor.role.specialistInstructor" },
  { value: "psychologist", labelKey: "instructor.role.psychologist" },
  { value: "office_staff", labelKey: "instructor.role.officeStaff" },
  { value: "track_responsible", labelKey: "instructor.role.trackResponsible" },
  { value: "accounting", labelKey: "instructor.role.accounting" },
  { value: "other", labelKey: "instructor.role.other" },
];

export const INSTRUCTOR_EMPLOYMENT_OPTIONS: Option<InstructorEmploymentType>[] = [
  { value: "salaried", labelKey: "instructor.employment.salaried" },
  { value: "hourly", labelKey: "instructor.employment.hourly" },
  { value: "other", labelKey: "instructor.employment.other" },
];

function buildLabelKeyMap<T extends string>(options: Option<T>[]): Record<T, TranslationKey> {
  return options.reduce(
    (acc, option) => ({ ...acc, [option.value]: option.labelKey }),
    {} as Record<T, TranslationKey>
  );
}

export const INSTRUCTOR_ROLE_LABEL_KEYS = buildLabelKeyMap(INSTRUCTOR_ROLE_OPTIONS);
export const INSTRUCTOR_EMPLOYMENT_LABEL_KEYS = buildLabelKeyMap(INSTRUCTOR_EMPLOYMENT_OPTIONS);
