import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../lib/auth";
import {
  requestMigrationAccessCode,
  verifyMigrationAccessCode,
} from "../../lib/auth-api";
import { updateStoredInstitutionName } from "../../lib/auth-storage";
import { useT, type TranslationKey } from "../../lib/i18n";
import { getClassrooms } from "../../lib/classrooms-api";
import { ApiError } from "../../lib/http";
import {
  createClassroomInventoryImportJob,
  createGroupInventoryImportJob,
  createInstitutionInventoryImportJob,
  createInstructorInventoryImportJob,
  createLicenseClassInventoryImportJob,
  createCandidatePhotoImportJob,
  createCandidateSyncByNationalIdJob,
  createTheoryScheduleImportJob,
  createVehicleInventoryImportJob,
  getMebbisJob,
  type MebbisJobResponse,
} from "../../lib/mebbis-jobs-api";
import { deleteInstitutionCandidates, getCandidates } from "../../lib/candidates-api";
import { getGroups } from "../../lib/groups-api";
import { applyMebbisClassroomInventory } from "../../lib/mebbis-classroom-import";
import { applyMebbisInstitutionInventory } from "../../lib/mebbis-institution-import";
import { applyMebbisInstructorInventory } from "../../lib/mebbis-instructor-import";
import { applyMebbisLicenseClassInventory } from "../../lib/mebbis-license-class-import";
import { applyMebbisVehicleInventory } from "../../lib/mebbis-vehicle-import";
import { candidateKeys } from "../../lib/queries/use-candidates";
import type { GroupResponse } from "../../lib/types";
import { MebIcon } from "../icons";
import { useToast } from "../ui/Toast";

const MIGRATION_POLL_INTERVAL_MS = 5000;
const GROUP_IMPORT_POLL_TIMEOUT_MS = 30 * 60 * 1000;
const CLASSROOM_IMPORT_POLL_TIMEOUT_MS = 60 * 1000;
const VEHICLE_IMPORT_POLL_TIMEOUT_MS = 5 * 60 * 1000;
const INSTRUCTOR_IMPORT_POLL_TIMEOUT_MS = 10 * 60 * 1000;
const LICENSE_CLASS_IMPORT_POLL_TIMEOUT_MS = 60 * 1000;
const INSTITUTION_IMPORT_POLL_TIMEOUT_MS = 60 * 1000;
const MIGRATION_ACCESS_STORAGE_PREFIX = "pilot.migration.access";
const CANDIDATE_NATIONAL_IDS_STORAGE_KEY = "pilot.mebbis.candidateNationalIds";

type MigrationActionKey =
  | "general"
  | "licenseClasses"
  | "classrooms"
  | "vehicles"
  | "instructors"
  | "candidateSync"
  | "candidatePhotos"
  | "deleteCandidates"
  | "groups"
  | "theorySchedule";

type MigrationAction = {
  key: MigrationActionKey;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  enabled: boolean;
  buttonLabelKey?: TranslationKey;
  runningLabelKey?: TranslationKey;
  tone?: "secondary" | "danger";
};

type MigrationGroup = {
  titleKey: TranslationKey;
  actions: MigrationAction[];
};

const MIGRATION_GROUPS: MigrationGroup[] = [
  {
    titleKey: "settings.migration.group.institution",
    actions: [
      {
        key: "general",
        titleKey: "settings.migration.action.general.title",
        descriptionKey: "settings.migration.action.general.description",
        enabled: true,
      },
      {
        key: "licenseClasses",
        titleKey: "settings.migration.action.licenseClasses.title",
        descriptionKey: "settings.migration.action.licenseClasses.description",
        enabled: true,
      },
      {
        key: "classrooms",
        titleKey: "settings.migration.action.classrooms.title",
        descriptionKey: "settings.migration.action.classrooms.description",
        enabled: true,
      },
      {
        key: "instructors",
        titleKey: "settings.migration.action.instructors.title",
        descriptionKey: "settings.migration.action.instructors.description",
        enabled: true,
      },
      {
        key: "vehicles",
        titleKey: "settings.migration.action.vehicles.title",
        descriptionKey: "settings.migration.action.vehicles.description",
        enabled: true,
      },
    ],
  },
  {
    titleKey: "settings.migration.group.training",
    actions: [
      {
        key: "groups",
        titleKey: "settings.migration.action.groups.title",
        descriptionKey: "settings.migration.action.groups.description",
        enabled: true,
      },
      {
        key: "theorySchedule",
        titleKey: "settings.migration.action.theorySchedule.title",
        descriptionKey: "settings.migration.action.theorySchedule.description",
        enabled: true,
      },
      {
        key: "candidateSync",
        titleKey: "settings.migration.action.candidateSync.title",
        descriptionKey: "settings.migration.action.candidateSync.description",
        enabled: true,
      },
      {
        key: "candidatePhotos",
        titleKey: "settings.migration.action.candidatePhotos.title",
        descriptionKey: "settings.migration.action.candidatePhotos.description",
        enabled: true,
      },
    ],
  },
  {
    titleKey: "settings.migration.group.cleanup",
    actions: [
      {
        key: "deleteCandidates",
        titleKey: "settings.migration.action.deleteCandidates.title",
        descriptionKey: "settings.migration.action.deleteCandidates.description",
        enabled: true,
        buttonLabelKey: "settings.migration.action.deleteCandidates.button",
        runningLabelKey: "settings.migration.action.deleteCandidates.running",
        tone: "danger",
      },
    ],
  },
];

export function MigrationSettingsSection() {
  const t = useT();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { activeInstitution, user } = useAuth();
  const [runningAction, setRunningAction] = useState<MigrationActionKey | null>(null);
  const migrationAccessStorageKey = activeInstitution && user
    ? `${MIGRATION_ACCESS_STORAGE_PREFIX}.${user.id}.${activeInstitution.id}`
    : MIGRATION_ACCESS_STORAGE_PREFIX;
  const [migrationAccessExpiresAtUtc, setMigrationAccessExpiresAtUtc] = useState<string | null>(
    () => readMigrationAccessExpiresAt(migrationAccessStorageKey)
  );
  const [adminCode, setAdminCode] = useState("");
  const [requestingAdminCode, setRequestingAdminCode] = useState(false);
  const [verifyingAdminCode, setVerifyingAdminCode] = useState(false);
  const [candidateNationalIdsJson, setCandidateNationalIdsJson] = useState("");
  const hasMigrationAccess =
    migrationAccessExpiresAtUtc !== null &&
    new Date(migrationAccessExpiresAtUtc).getTime() > Date.now();

  useEffect(() => {
    if (activeInstitution) {
      clearMigrationAccessExpiresAt(`${MIGRATION_ACCESS_STORAGE_PREFIX}.${activeInstitution.id}`);
    }
    setMigrationAccessExpiresAtUtc(readMigrationAccessExpiresAt(migrationAccessStorageKey));
    setAdminCode("");
  }, [activeInstitution, migrationAccessStorageKey]);

  const handleRequestAdminCode = async () => {
    if (requestingAdminCode) return;
    setRequestingAdminCode(true);
    try {
      const result = await requestMigrationAccessCode();
      showToast(
        t("settings.migration.access.requested", {
          count: String(result.recipientCount),
        })
      );
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? error.problemTitle ?? t("settings.migration.access.requestFailed")
          : t("settings.migration.access.requestFailed");
      showToast(message, "error");
    } finally {
      setRequestingAdminCode(false);
    }
  };

  const handleVerifyAdminCode = async () => {
    if (verifyingAdminCode) return;
    const code = adminCode.replace(/[^\d]/g, "");
    if (code.length === 0) {
      showToast(t("settings.migration.access.codeRequired"), "error");
      return;
    }

    setVerifyingAdminCode(true);
    try {
      const result = await verifyMigrationAccessCode(code);
      writeMigrationAccessExpiresAt(migrationAccessStorageKey, result.expiresAtUtc);
      setMigrationAccessExpiresAtUtc(result.expiresAtUtc);
      setAdminCode("");
      showToast(t("settings.migration.access.unlocked"));
    } catch (error) {
      console.error(error);
      showToast(t("settings.migration.access.verifyFailed"), "error");
    } finally {
      setVerifyingAdminCode(false);
    }
  };

  const handleManualCandidateNationalIdsSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = parseCandidateNationalIdsJson(candidateNationalIdsJson);
    if (!result.ok) {
      showToast(result.message, "error");
      return;
    }

    localStorage.setItem(CANDIDATE_NATIONAL_IDS_STORAGE_KEY, JSON.stringify(result.storageValue));
    showToast(`${result.nationalIds.length} TC localStorage'a kaydedildi`);
  };

  const invalidateInstitutionImportData = () => {
    void queryClient.invalidateQueries({ queryKey: ["settings", "institution-settings"] });
    void queryClient.invalidateQueries({ queryKey: ["institutions", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const invalidateMebbisData = () => {
    void queryClient.invalidateQueries({ queryKey: ["groups"] });
    void queryClient.invalidateQueries({ queryKey: ["candidates"] });
    void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const invalidateClassroomImportData = () => {
    void queryClient.invalidateQueries({ queryKey: ["settings", "classrooms"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const invalidateLicenseClassImportData = () => {
    void queryClient.invalidateQueries({ queryKey: ["licenseClassDefinitions"] });
    void queryClient.invalidateQueries({ queryKey: ["settings", "license-class-definitions"] });
    void queryClient.invalidateQueries({ queryKey: ["settings", "license-class-fee-matrix"] });
    void queryClient.invalidateQueries({ queryKey: ["finance", "license-class-fee-matrix"] });
    void queryClient.invalidateQueries({ queryKey: ["candidate-detail", "exam-attempt-fee-matrix"] });
    void queryClient.invalidateQueries({ queryKey: ["candidate-detail", "contract-back-fee-matrix"] });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["training", "vehicles"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "instructors"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
    void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const invalidateVehicleImportData = () => {
    void queryClient.invalidateQueries({ queryKey: ["settings", "vehicles"] });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const invalidateInstructorImportData = () => {
    void queryClient.invalidateQueries({ queryKey: ["settings", "instructors"] });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const invalidateCandidatePhotoImportData = () => {
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["documents", "candidate-checklist"] });
    void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const invalidateCandidateSyncImportData = () => {
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "queue", "status"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const invalidateTheoryScheduleImportData = () => {
    void queryClient.invalidateQueries({ queryKey: ["groups"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
    void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const pollMebbisImportJob = async (
    jobId: string,
    timeoutMs = GROUP_IMPORT_POLL_TIMEOUT_MS
  ): Promise<MebbisJobResponse | null> => {
    const timeoutAt = Date.now() + timeoutMs;

    while (Date.now() < timeoutAt) {
      await new Promise((resolve) => window.setTimeout(resolve, MIGRATION_POLL_INTERVAL_MS));

      let job: MebbisJobResponse;
      try {
        job = await getMebbisJob(jobId);
      } catch (error) {
        console.error(error);
        continue;
      }

      if (job.status === "succeeded") {
        return job;
      }

      if (["failed", "needs_manual_action", "cancelled"].includes(job.status)) {
        return job;
      }
    }

    return null;
  };

  const runGroupInventoryImport = async () => {
    setRunningAction("groups");
    try {
      const classrooms = await getClassrooms({ activity: "active", pageSize: 1 });
      if (classrooms.totalCount === 0) {
        showToast(t("groups.mebbisImportClassroomsRequired"), "error");
        return;
      }

      const job = await createGroupInventoryImportJob();
      invalidateMebbisData();
      showToast(t("groups.mebbisImportQueued"));

      const completedJob = await pollMebbisImportJob(job.id);
      invalidateMebbisData();

      if (completedJob?.status === "succeeded") {
        window.setTimeout(invalidateMebbisData, 3000);
        window.setTimeout(invalidateMebbisData, 8000);
        showToast(t("groups.mebbisImportCompleted"));
        return;
      }

      if (completedJob) {
        showToast(t("groups.mebbisImportNeedsManualAction"), "error");
        return;
      }

      showToast(t("groups.mebbisImportStillRunning"));
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ?? t("groups.mebbisImportFailed")
          : t("groups.mebbisImportFailed");
      showToast(message, "error");
    } finally {
      setRunningAction(null);
    }
  };

  const runInstitutionInventoryImport = async () => {
    setRunningAction("general");
    try {
      const job = await createInstitutionInventoryImportJob();
      invalidateInstitutionImportData();
      showToast(t("settings.general.mebbisImportQueued"));

      const completedJob = await pollMebbisImportJob(job.id, INSTITUTION_IMPORT_POLL_TIMEOUT_MS);
      if (completedJob?.status === "succeeded") {
        const result = await applyMebbisInstitutionInventory(completedJob);
        if (activeInstitution && result.saved?.institutionName) {
          updateStoredInstitutionName(activeInstitution.id, result.saved.institutionName);
        }
        invalidateInstitutionImportData();

        showToast(
          result.applied
            ? t("settings.general.mebbisImportApplied")
            : t("settings.general.mebbisImportCompleted")
        );
        return;
      }

      invalidateInstitutionImportData();
      if (completedJob) {
        showToast(t("settings.general.mebbisImportNeedsManualAction"), "error");
        return;
      }

      showToast(t("settings.general.mebbisImportStillRunning"));
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
            t("settings.general.mebbisImportFailed")
          : t("settings.general.mebbisImportFailed");
      showToast(message, "error");
    } finally {
      setRunningAction(null);
    }
  };

  const runClassroomInventoryImport = async () => {
    setRunningAction("classrooms");
    try {
      const job = await createClassroomInventoryImportJob();
      invalidateClassroomImportData();
      showToast(t("settings.classrooms.mebbisImportQueued"));

      const completedJob = await pollMebbisImportJob(job.id, CLASSROOM_IMPORT_POLL_TIMEOUT_MS);
      if (completedJob?.status === "succeeded") {
        const result = await applyMebbisClassroomInventory(completedJob);
        invalidateClassroomImportData();

        if (result.importedCount === 0) {
          showToast(t("settings.classrooms.mebbisImportCompleted"));
          return;
        }

        if (result.missingTypes.length > 0) {
          showToast(
            t("settings.classrooms.mebbisImportMissingTypes", {
              types: result.missingTypes.join(", "),
            }),
            "error"
          );
          return;
        }

        showToast(
          t("settings.classrooms.mebbisImportApplied", {
            created: String(result.createdCount),
            updated: String(result.updatedCount),
          })
        );
        return;
      }

      invalidateClassroomImportData();
      if (completedJob) {
        showToast(t("settings.classrooms.mebbisImportNeedsManualAction"), "error");
        return;
      }

      showToast(t("settings.classrooms.mebbisImportStillRunning"));
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
            t("settings.classrooms.mebbisImportFailed")
          : t("settings.classrooms.mebbisImportFailed");
      showToast(message, "error");
    } finally {
      setRunningAction(null);
    }
  };

  const runLicenseClassInventoryImport = async () => {
    setRunningAction("licenseClasses");
    try {
      const job = await createLicenseClassInventoryImportJob();
      invalidateLicenseClassImportData();
      showToast(t("settings.licenseClasses.mebbisImportQueued"));

      const completedJob = await pollMebbisImportJob(job.id, LICENSE_CLASS_IMPORT_POLL_TIMEOUT_MS);
      if (completedJob?.status === "succeeded") {
        const result = await applyMebbisLicenseClassInventory(completedJob);
        invalidateLicenseClassImportData();

        if (result.matchedCount === 0) {
          showToast(t("settings.licenseClasses.mebbisImportCompleted"));
          return;
        }

        showToast(
          t("settings.licenseClasses.mebbisImportApplied", {
            count: String(result.activatedCount),
            total: String(result.matchedCount),
          })
        );
        return;
      }

      invalidateLicenseClassImportData();
      if (completedJob) {
        showToast(t("settings.licenseClasses.mebbisImportNeedsManualAction"), "error");
        return;
      }

      showToast(t("settings.licenseClasses.mebbisImportStillRunning"));
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
            t("settings.licenseClasses.mebbisImportFailed")
          : t("settings.licenseClasses.mebbisImportFailed");
      showToast(message, "error");
    } finally {
      setRunningAction(null);
    }
  };

  const runVehicleInventoryImport = async () => {
    setRunningAction("vehicles");
    try {
      const job = await createVehicleInventoryImportJob();
      invalidateVehicleImportData();
      showToast(t("settings.vehicles.mebbisImportQueued"));

      const completedJob = await pollMebbisImportJob(job.id, VEHICLE_IMPORT_POLL_TIMEOUT_MS);
      if (completedJob?.status === "succeeded") {
        const result = await applyMebbisVehicleInventory(completedJob);
        invalidateVehicleImportData();

        if (result.importedCount === 0) {
          showToast(t("settings.vehicles.mebbisImportCompleted"));
          return;
        }

        if (result.documentErrorCount > 0) {
          showToast(
            t("settings.vehicles.mebbisImportDocumentFailed", {
              count: String(result.documentErrorCount),
            }),
            "error"
          );
        }

        showToast(
          t("settings.vehicles.mebbisImportApplied", {
            created: String(result.createdCount),
            updated: String(result.updatedCount),
            inspections: String(result.inspectionDocumentCount),
            insurances: String(result.insuranceDocumentCount),
          })
        );
        return;
      }

      invalidateVehicleImportData();
      if (completedJob) {
        showToast(t("settings.vehicles.mebbisImportNeedsManualAction"), "error");
        return;
      }

      showToast(t("settings.vehicles.mebbisImportStillRunning"));
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
            t("settings.vehicles.mebbisImportFailed")
          : t("settings.vehicles.mebbisImportFailed");
      showToast(message, "error");
    } finally {
      setRunningAction(null);
    }
  };

  const runInstructorInventoryImport = async () => {
    setRunningAction("instructors");
    try {
      const job = await createInstructorInventoryImportJob();
      invalidateInstructorImportData();
      showToast(t("settings.instructors.mebbisImportQueued"));

      const completedJob = await pollMebbisImportJob(job.id, INSTRUCTOR_IMPORT_POLL_TIMEOUT_MS);
      if (completedJob?.status === "succeeded") {
        const result = await applyMebbisInstructorInventory(completedJob);
        invalidateInstructorImportData();

        if (result.importedCount === 0) {
          showToast(t("settings.instructors.mebbisImportCompleted"));
          return;
        }

        showToast(
          t("settings.instructors.mebbisImportApplied", {
            created: String(result.createdCount),
            updated: String(result.updatedCount),
          })
        );
        return;
      }

      invalidateInstructorImportData();
      if (completedJob) {
        showToast(t("settings.instructors.mebbisImportNeedsManualAction"), "error");
        return;
      }

      showToast(t("settings.instructors.mebbisImportStillRunning"));
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
            t("settings.instructors.mebbisImportFailed")
          : t("settings.instructors.mebbisImportFailed");
      showToast(message, "error");
    } finally {
      setRunningAction(null);
    }
  };

  const loadAllGroupsForTheoryScheduleImport = async (): Promise<GroupResponse[]> => {
    const firstPage = await getGroups({ page: 1, pageSize: 100 });
    const pageSize = firstPage.pageSize || 100;
    const totalCount = firstPage.totalCount ?? firstPage.items.length;
    const allGroups = [...firstPage.items];
    let page = firstPage.page || 1;

    while (allGroups.length < totalCount) {
      const nextPage = page + 1;
      const response = await getGroups({ page: nextPage, pageSize });
      if (response.items.length === 0) break;
      allGroups.push(...response.items);
      page = response.page || nextPage;
    }

    return [...new Map(allGroups.map((group) => [group.id, group])).values()];
  };

  const loadCandidatesMissingPhoto = async () => {
    const firstPage = await getCandidates({ page: 1, pageSize: 100 });
    const pageSize = firstPage.pageSize || 100;
    const totalCount = firstPage.totalCount ?? firstPage.items.length;
    const allCandidates = [...firstPage.items];
    let page = firstPage.page || 1;

    while (allCandidates.length < totalCount) {
      const nextPage = page + 1;
      const response = await getCandidates({ page: nextPage, pageSize });
      if (response.items.length === 0) break;
      allCandidates.push(...response.items);
      page = response.page || nextPage;
    }

    return [...new Map(allCandidates.map((candidate) => [candidate.id, candidate])).values()]
      .filter((candidate) => Boolean(candidate.id && candidate.nationalId && !candidate.photo));
  };

  const runCandidatePhotoImport = async () => {
    setRunningAction("candidatePhotos");
    try {
      const candidates = await loadCandidatesMissingPhoto();
      if (candidates.length === 0) {
        showToast(t("settings.migration.action.candidatePhotos.empty"));
        return;
      }

      let queuedCount = 0;
      for (const candidate of candidates) {
        await createCandidatePhotoImportJob(candidate.id);
        queuedCount += 1;
      }

      invalidateCandidatePhotoImportData();
      showToast(
        t("settings.migration.action.candidatePhotos.queued", {
          count: String(queuedCount),
        })
      );
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
            t("settings.migration.action.candidatePhotos.failed")
          : t("settings.migration.action.candidatePhotos.failed");
      showToast(message, "error");
    } finally {
      setRunningAction(null);
    }
  };

  const runCandidateSyncImport = async () => {
    setRunningAction("candidateSync");
    try {
      const raw = localStorage.getItem(CANDIDATE_NATIONAL_IDS_STORAGE_KEY);
      if (!raw) {
        showToast(t("settings.migration.action.candidateSync.empty"), "error");
        return;
      }

      const parsed = parseCandidateNationalIdsJson(raw);
      if (!parsed.ok) {
        showToast(parsed.message, "error");
        return;
      }

      const targets = buildCandidateSyncTargets(parsed.storageValue);
      if (targets.length === 0) {
        showToast(t("settings.migration.action.candidateSync.empty"), "error");
        return;
      }

      let queuedCount = 0;
      for (const target of targets) {
        await createCandidateSyncByNationalIdJob(target.nationalId);
        queuedCount += 1;
      }

      invalidateCandidateSyncImportData();
      showToast(
        t("settings.migration.action.candidateSync.queued", {
          count: String(queuedCount),
        })
      );
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
            t("settings.migration.action.candidateSync.failed")
          : t("settings.migration.action.candidateSync.failed");
      showToast(message, "error");
    } finally {
      setRunningAction(null);
    }
  };

  const runTheoryScheduleImport = async () => {
    setRunningAction("theorySchedule");
    try {
      const groups = await loadAllGroupsForTheoryScheduleImport();
      if (groups.length === 0) {
        showToast(t("training.toast.noGroupsForMebbisImport"), "error");
        return;
      }

      let queuedCount = 0;
      for (const group of groups) {
        await createTheoryScheduleImportJob(group.id);
        queuedCount += 1;
      }

      invalidateTheoryScheduleImportData();
      showToast(t("training.toast.mebbisImportQueuedForGroups", { count: String(queuedCount) }));
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
            t("training.toast.mebbisImportFailed")
          : t("training.toast.mebbisImportFailed");
      showToast(message, "error");
    } finally {
      setRunningAction(null);
    }
  };

  const runDeleteCandidates = async () => {
    if (!activeInstitution) {
      showToast(t("settings.migration.action.deleteCandidates.noInstitution"), "error");
      return;
    }

    const confirmed = window.confirm(
      t("settings.migration.action.deleteCandidates.confirm", {
        institution: activeInstitution.name,
      })
    );
    if (!confirmed) return;

    setRunningAction("deleteCandidates");
    try {
      const result = await deleteInstitutionCandidates();
      invalidateCandidateSyncImportData();
      showToast(
        t("settings.migration.action.deleteCandidates.completed", {
          count: String(result.deletedCount),
        })
      );
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
            error.problemTitle ??
            t("settings.migration.action.deleteCandidates.failed")
          : t("settings.migration.action.deleteCandidates.failed");
      showToast(message, "error");
    } finally {
      setRunningAction(null);
    }
  };

  const runMigrationAction = async (action: MigrationAction) => {
    if (!action.enabled || runningAction) return;

    if (action.key === "general") {
      await runInstitutionInventoryImport();
      return;
    }

    if (action.key === "classrooms") {
      await runClassroomInventoryImport();
      return;
    }

    if (action.key === "licenseClasses") {
      await runLicenseClassInventoryImport();
      return;
    }

    if (action.key === "vehicles") {
      await runVehicleInventoryImport();
      return;
    }

    if (action.key === "instructors") {
      await runInstructorInventoryImport();
      return;
    }

    if (action.key === "candidatePhotos") {
      await runCandidatePhotoImport();
      return;
    }

    if (action.key === "candidateSync") {
      await runCandidateSyncImport();
      return;
    }

    if (action.key === "groups") {
      await runGroupInventoryImport();
      return;
    }

    if (action.key === "theorySchedule") {
      await runTheoryScheduleImport();
      return;
    }

    if (action.key === "deleteCandidates") {
      await runDeleteCandidates();
    }
  };

  return (
    <div className="settings-section-stack">
      <div className="settings-tab-toolbar integrations-tab-toolbar">
        <div aria-label={t("settings.migration.title")} className="page-tabs" role="tablist">
          <button aria-selected="true" className="page-tab active" role="tab" type="button">
            {t("settings.migration.tab.mebbis")}
          </button>
        </div>
      </div>

      <section className="settings-surface">
        <div className="settings-surface-header">
          <h2 className="settings-surface-title">{t("settings.migration.title")}</h2>
        </div>

        <div className="settings-surface-body">
          <div className="settings-info-list">
            <div className="settings-info-item">
              <div>
                <div className="settings-info-title">{t("settings.migration.info.title")}</div>
                <div className="settings-info-note">{t("settings.migration.info.description")}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!hasMigrationAccess ? (
        <section className="settings-surface">
          <div className="settings-surface-header">
            <h2 className="settings-surface-title">{t("settings.migration.access.title")}</h2>
          </div>

          <div className="settings-surface-body">
            <div className="settings-info-list">
              <div className="settings-info-item">
                <div>
                  <div className="settings-info-title">{t("settings.migration.access.infoTitle")}</div>
                  <div className="settings-info-note">{t("settings.migration.access.infoDescription")}</div>
                </div>
              </div>
            </div>

            <div className="settings-form" style={{ marginTop: 16 }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="migration-admin-code">
                    {t("settings.migration.access.codeLabel")}
                  </label>
                  <input
                    className="form-input"
                    id="migration-admin-code"
                    inputMode="numeric"
                    maxLength={8}
                    onChange={(event) => setAdminCode(event.target.value.replace(/[^\d]/g, ""))}
                    placeholder={t("settings.migration.access.codePlaceholder")}
                    value={adminCode}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="btn btn-secondary"
                  disabled={requestingAdminCode}
                  onClick={() => void handleRequestAdminCode()}
                  type="button"
                >
                  {requestingAdminCode
                    ? t("settings.migration.access.requesting")
                    : t("settings.migration.access.request")}
                </button>
                <button
                  className="btn btn-primary"
                  disabled={verifyingAdminCode}
                  onClick={() => void handleVerifyAdminCode()}
                  type="button"
                >
                  {verifyingAdminCode
                    ? t("settings.migration.access.verifying")
                    : t("settings.migration.access.verify")}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          {MIGRATION_GROUPS.map((group, groupIndex) => {
            const previousActionCount = MIGRATION_GROUPS.slice(0, groupIndex).reduce(
              (count, previousGroup) => count + previousGroup.actions.length,
              0
            );

            return (
            <section className="settings-surface" key={group.titleKey}>
              <div className="settings-surface-header">
                <h2 className="settings-surface-title">{t(group.titleKey)}</h2>
              </div>

              <div className="settings-surface-body">
                <div className="settings-module-list">
                  {group.actions.map((action, actionIndex) => (
                    <div className="settings-module-item" key={action.titleKey}>
                      <div className="settings-module-copy">
                        <span className="settings-module-order">
                          {previousActionCount + actionIndex + 1}
                        </span>
                        <div>
                          <strong>{t(action.titleKey)}</strong>
                          <span>{t(action.descriptionKey)}</span>
                        </div>
                      </div>
                      <button
                        className={`btn btn-${action.tone ?? "secondary"} btn-sm`}
                        disabled={!action.enabled || Boolean(runningAction)}
                        onClick={() => void runMigrationAction(action)}
                        type="button"
                      >
                        <MebIcon size={14} />
                        {runningAction === action.key
                          ? t(action.runningLabelKey ?? "settings.migration.action.running")
                          : action.enabled
                            ? t(action.buttonLabelKey ?? "settings.migration.action.run")
                            : t("settings.migration.action.pending")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            );
          })}

          <section className="settings-surface">
            <div className="settings-surface-header">
              <h2 className="settings-surface-title">{t("settings.migration.group.operations")}</h2>
            </div>

            <div className="settings-surface-body">
              <div className="settings-module-list">
                <div className="settings-module-item">
                  <div>
                    <strong>{t("settings.migration.action.jobs.title")}</strong>
                    <span>{t("settings.migration.action.jobs.description")}</span>
                  </div>
                  <Link className="btn btn-secondary btn-sm" to="/meb-jobs">
                    <MebIcon size={14} />
                    {t("settings.migration.action.open")}
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="settings-surface">
            <div className="settings-surface-header">
              <h2 className="settings-surface-title">MEBBİS aday TC listesi</h2>
            </div>
            <form className="settings-form" onSubmit={handleManualCandidateNationalIdsSave}>
              <div className="form-group">
                <label className="form-label" htmlFor="candidate-national-ids-json">
                  Aday JSON listesi
                </label>
                <textarea
                  className="form-input"
                  id="candidate-national-ids-json"
                  onChange={(event) => setCandidateNationalIdsJson(event.target.value)}
                  placeholder='["10122067560","29792595570"]'
                  rows={8}
                  value={candidateNationalIdsJson}
                />
              </div>
              <div className="settings-form-actions">
                <button className="btn btn-primary" type="submit">
                  TC Listesini Kaydet
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}

function readMigrationAccessExpiresAt(storageKey: string): string | null {
  const value = localStorage.getItem(storageKey) ?? sessionStorage.getItem(storageKey);
  if (!value) return null;
  const expiresAt = new Date(value).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    clearMigrationAccessExpiresAt(storageKey);
    return null;
  }
  if (!localStorage.getItem(storageKey)) {
    localStorage.setItem(storageKey, value);
    sessionStorage.removeItem(storageKey);
  }
  return value;
}

function writeMigrationAccessExpiresAt(storageKey: string, expiresAtUtc: string): void {
  localStorage.setItem(storageKey, expiresAtUtc);
  sessionStorage.removeItem(storageKey);
}

function clearMigrationAccessExpiresAt(storageKey: string): void {
  localStorage.removeItem(storageKey);
  sessionStorage.removeItem(storageKey);
}

type CandidateNationalIdsParseResult =
  | { ok: true; nationalIds: string[]; storageValue: string[] }
  | { ok: false; message: string };

type CandidateSyncTarget = {
  nationalId: string;
};

function buildCandidateSyncTargets(storageValue: string[]): CandidateSyncTarget[] {
  const targets: CandidateSyncTarget[] = [];
  const seen = new Set<string>();

  for (const value of storageValue) {
    const nationalId = String(value ?? "").replace(/\D/g, "");
    if (!/^[1-9]\d{10}$/.test(nationalId) || seen.has(nationalId)) continue;
    seen.add(nationalId);
    targets.push({ nationalId });
  }

  return targets;
}

function parseCandidateNationalIdsJson(value: string): CandidateNationalIdsParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { ok: false, message: "Geçerli JSON girin." };
  }

  const nationalIds: string[] = [];
  const seen = new Set<string>();
  const addNationalId = (candidate: unknown) => {
    const nationalId = String(candidate ?? "").replace(/\D/g, "");
    if (!/^[1-9]\d{10}$/.test(nationalId) || seen.has(nationalId)) return;
    seen.add(nationalId);
    nationalIds.push(nationalId);
  };

  if (!Array.isArray(parsed)) {
    return { ok: false, message: "JSON TC listesini içeren array formatında olmalı." };
  }

  parsed.forEach(addNationalId);
  if (nationalIds.length === 0) {
    return { ok: false, message: "JSON içinde geçerli TC bulunamadı." };
  }
  return { ok: true, nationalIds, storageValue: nationalIds };
}
