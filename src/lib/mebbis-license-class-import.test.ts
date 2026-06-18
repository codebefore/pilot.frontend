import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyMebbisLicenseClassInventory } from "./mebbis-license-class-import";
import type { MebbisJobResponse } from "./mebbis-jobs-api";

const getLicenseClassDefinitionsMock = vi.fn();
const updateLicenseClassDefinitionActivityMock = vi.fn();

vi.mock("./license-class-definitions-api", async () => {
  const actual = await vi.importActual<typeof import("./license-class-definitions-api")>(
    "./license-class-definitions-api"
  );

  return {
    ...actual,
    getLicenseClassDefinitions: (
      ...args: Parameters<typeof actual.getLicenseClassDefinitions>
    ) => getLicenseClassDefinitionsMock(...args),
    updateLicenseClassDefinitionActivity: (
      ...args: Parameters<typeof actual.updateLicenseClassDefinitionActivity>
    ) => updateLicenseClassDefinitionActivityMock(...args),
  };
});

const sampleLicenseClass = {
  id: "lc1",
  code: "B",
  name: "B Otomobil",
  minimumAge: 18,
  existingLicenseType: null,
  theoryLessonHours: 34,
  directPracticeLessonHours: 14,
  displayOrder: 20,
  isActive: true,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
  rowVersion: 1,
};

describe("applyMebbisLicenseClassInventory", () => {
  beforeEach(() => {
    getLicenseClassDefinitionsMock.mockReset();
    updateLicenseClassDefinitionActivityMock.mockReset();
  });

  it("activates matching manual and automatic license classes from MEBBIS", async () => {
    getLicenseClassDefinitionsMock.mockResolvedValue({
      items: [
        {
          ...sampleLicenseClass,
          id: "lc-a1",
          code: "A1",
          name: "A1 Motosiklet",
          isActive: false,
          rowVersion: 4,
        },
        {
          ...sampleLicenseClass,
          id: "lc-a1-auto",
          code: "A1-OTOMATIK",
          name: "A1 Motosiklet - Otomatik",
          isActive: false,
          rowVersion: 5,
        },
        {
          ...sampleLicenseClass,
          id: "lc-a1-transition",
          code: "A1",
          name: "A1 Motosiklet",
          existingLicenseType: "B",
          isActive: false,
          rowVersion: 6,
        },
      ],
      page: 1,
      pageSize: 1000,
      totalCount: 3,
      totalPages: 1,
      summary: { activeCount: 0 },
    });

    const job: MebbisJobResponse = {
      id: "job-1",
      jobType: "license_class_inventory_import",
      entityType: null,
      entityId: null,
      status: "succeeded",
      priority: 0,
      payloadJson: "{}",
      resultJson: JSON.stringify({
        programs: [{ programName: "A1 SINIFI SERTIFIKA", licenseClassCode: "A1" }],
      }),
      errorMessage: null,
      attemptCount: 1,
      maxAttemptCount: 3,
      nextAttemptAtUtc: null,
      leaseOwnerClientId: null,
      leaseExpiresAtUtc: null,
      startedAtUtc: "2026-01-01T00:00:00Z",
      completedAtUtc: "2026-01-01T00:00:01Z",
      createdAtUtc: "2026-01-01T00:00:00Z",
      updatedAtUtc: "2026-01-01T00:00:01Z",
      rowVersion: 1,
    };

    const result = await applyMebbisLicenseClassInventory(job);

    expect(updateLicenseClassDefinitionActivityMock).toHaveBeenCalledWith("lc-a1", {
      isActive: true,
      rowVersion: 4,
    });
    expect(updateLicenseClassDefinitionActivityMock).toHaveBeenCalledWith("lc-a1-auto", {
      isActive: true,
      rowVersion: 5,
    });
    expect(updateLicenseClassDefinitionActivityMock).not.toHaveBeenCalledWith(
      "lc-a1-transition",
      expect.anything()
    );
    expect(getLicenseClassDefinitionsMock).toHaveBeenCalledWith({
      activity: "all",
      page: 1,
      pageSize: 1000,
    });
    expect(result).toEqual({
      matchedCount: 2,
      activatedCount: 2,
    });
  });
});
