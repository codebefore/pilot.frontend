import {
  getInstitutionSettings,
  upsertInstitutionSettings,
  type FounderType,
  type InstitutionSettingsResponse,
  type InstitutionSettingsUpsertRequest,
} from "./institution-settings-api";
import type { MebbisJobResponse } from "./mebbis-jobs-api";
import {
  resolveTurkeyDistrictValue,
  resolveTurkeyProvinceValue,
} from "./turkey-address-options";

type MebbisInstitutionInventoryResult = {
  institution?: {
    institutionCode?: unknown;
    institutionName?: unknown;
    institutionOfficialName?: unknown;
    address?: unknown;
    phone?: unknown;
    email?: unknown;
    city?: unknown;
    district?: unknown;
    buildingCapacity?: unknown;
  };
  founder?: {
    type?: unknown;
    name?: unknown;
    taxId?: unknown;
    taxOffice?: unknown;
    address?: unknown;
    phone?: unknown;
  };
};

type InstitutionImportValues = {
  institutionName: string;
  institutionOfficialName: string;
  institutionCode: string;
  institutionAddress: string;
  institutionPhone: string;
  institutionEmail: string;
  city: string;
  district: string;
  buildingCapacity: number | null;
  bankName: string;
  iban: string;
  founderType: FounderType;
  founderName: string;
  founderTaxId: string;
  founderTaxOffice: string;
  founderAddress: string;
  founderPhone: string;
};

export type MebbisInstitutionInventoryApplyResult = {
  applied: boolean;
  saved: InstitutionSettingsResponse | null;
};

const PHONE_MAX_DIGITS = 10;

export async function applyMebbisInstitutionInventory(
  job: MebbisJobResponse
): Promise<MebbisInstitutionInventoryApplyResult> {
  const result = parseMebbisInstitutionInventoryResult(job);
  if (!result) {
    return {
      applied: false,
      saved: null,
    };
  }

  const currentSettings = await getInstitutionSettings();
  const currentValues = currentSettings ? fromResponse(currentSettings) : EMPTY_VALUES;
  const importedValues = mergeMebbisInstitutionValues(currentValues, result);
  const saved = await upsertInstitutionSettings(
    toUpsertRequest(
      importedValues,
      currentSettings?.rowVersion ?? null,
      currentSettings?.authorizedPersons ?? []
    )
  );

  return {
    applied: true,
    saved,
  };
}

const EMPTY_VALUES: InstitutionImportValues = {
  institutionName: "",
  institutionOfficialName: "",
  institutionCode: "",
  institutionAddress: "",
  institutionPhone: "",
  institutionEmail: "",
  city: "",
  district: "",
  buildingCapacity: null,
  bankName: "",
  iban: "",
  founderType: "real",
  founderName: "",
  founderTaxId: "",
  founderTaxOffice: "",
  founderAddress: "",
  founderPhone: "",
};

function normalizeGeneralPhone(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").replace(/^0+/, "").slice(0, PHONE_MAX_DIGITS);
}

function fromResponse(response: InstitutionSettingsResponse): InstitutionImportValues {
  const city = resolveTurkeyProvinceValue(response.city);
  return {
    institutionName: response.institutionName ?? "",
    institutionOfficialName: response.institutionOfficialName ?? "",
    institutionCode: response.institutionCode ?? "",
    institutionAddress: response.institutionAddress ?? "",
    institutionPhone: normalizeGeneralPhone(response.institutionPhone),
    institutionEmail: response.institutionEmail ?? "",
    city,
    district: resolveTurkeyDistrictValue(city, response.district),
    buildingCapacity: response.buildingCapacity ?? null,
    bankName: response.bankName ?? "",
    iban: response.iban ?? "",
    founderType: (response.founder.type as FounderType | null) ?? "real",
    founderName: response.founder.name ?? "",
    founderTaxId: response.founder.taxId ?? "",
    founderTaxOffice: response.founder.taxOffice ?? "",
    founderAddress: response.founder.address ?? "",
    founderPhone: normalizeGeneralPhone(response.founder.phone),
  };
}

function toUpsertRequest(
  values: InstitutionImportValues,
  rowVersion: number | null,
  authorizedPersons: InstitutionSettingsResponse["authorizedPersons"] = []
): InstitutionSettingsUpsertRequest {
  return {
    institutionName: values.institutionName.trim() || null,
    institutionOfficialName: values.institutionOfficialName.trim() || null,
    institutionCode: values.institutionCode.trim() || null,
    institutionAddress: values.institutionAddress.trim() || null,
    institutionPhone: normalizeGeneralPhone(values.institutionPhone) || null,
    institutionEmail: values.institutionEmail.trim() || null,
    city: values.city.trim() || null,
    district: values.district.trim() || null,
    buildingCapacity: values.buildingCapacity,
    bankName: values.bankName.trim() || null,
    iban: values.iban.trim() || null,
    founder: {
      type: values.founderType,
      name: values.founderName.trim() || null,
      taxId: values.founderTaxId.trim() || null,
      taxOffice: values.founderTaxOffice.trim() || null,
      address: values.founderAddress.trim() || null,
      phone: normalizeGeneralPhone(values.founderPhone) || null,
    },
    authorizedPersons,
    rowVersion,
  };
}

function readMebbisString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readMebbisFounderType(value: unknown): FounderType {
  return readMebbisString(value) === "legal" ? "legal" : "real";
}

function readMebbisNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const digits = readMebbisString(value).replace(/\D/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMebbisInstitutionInventoryResult(
  job: MebbisJobResponse
): MebbisInstitutionInventoryResult | null {
  if (!job.resultJson) return null;
  try {
    const parsed = JSON.parse(job.resultJson) as MebbisInstitutionInventoryResult;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function mergeMebbisInstitutionValues(
  current: InstitutionImportValues,
  result: MebbisInstitutionInventoryResult
): InstitutionImportValues {
  const institution = result.institution ?? {};
  const founder = result.founder ?? {};
  const importedCity = resolveTurkeyProvinceValue(readMebbisString(institution.city));

  return {
    ...current,
    institutionName: readMebbisString(institution.institutionName) || current.institutionName,
    institutionOfficialName:
      readMebbisString(institution.institutionOfficialName) ||
      readMebbisString(institution.institutionName) ||
      current.institutionOfficialName,
    institutionCode: readMebbisString(institution.institutionCode) || current.institutionCode,
    institutionAddress: readMebbisString(institution.address) || current.institutionAddress,
    institutionPhone:
      normalizeGeneralPhone(readMebbisString(institution.phone)) || current.institutionPhone,
    institutionEmail: readMebbisString(institution.email) || current.institutionEmail,
    city: importedCity || current.city,
    district:
      resolveTurkeyDistrictValue(
        importedCity || current.city,
        readMebbisString(institution.district)
      ) || current.district,
    buildingCapacity:
      readMebbisNumber(institution.buildingCapacity) ?? current.buildingCapacity,
    founderType: readMebbisString(founder.type)
      ? readMebbisFounderType(founder.type)
      : current.founderType,
    founderName: readMebbisString(founder.name) || current.founderName,
    founderTaxId: readMebbisString(founder.taxId) || current.founderTaxId,
    founderTaxOffice: readMebbisString(founder.taxOffice) || current.founderTaxOffice,
    founderAddress: readMebbisString(founder.address) || current.founderAddress,
    founderPhone: normalizeGeneralPhone(readMebbisString(founder.phone)) || current.founderPhone,
  };
}
