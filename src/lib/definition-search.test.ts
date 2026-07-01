import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyRuntimeConfig } from "./api";
import { getLicenseClassDefinitions } from "./license-class-definitions-api";
import { getTrainingBranchDefinitions } from "./training-branch-definitions-api";

describe("definition local search", () => {
  beforeEach(() => {
    applyRuntimeConfig(undefined);
    vi.restoreAllMocks();
  });

  it("matches license class names with accentless queries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              licenseClassDefinitionId: "lc1",
              code: "D",
              name: "D Sınıfı",
              minimumAge: 24,
              existingLicenseType: "B",
              theoryLessonHours: 34,
              directPracticeLessonHours: 14,
              displayOrder: 10,
              isActive: true,
              updatedAtUtc: "2026-01-01T00:00:00Z",
              rowVersion: 1,
            },
            {
              licenseClassDefinitionId: "lc2",
              code: "A",
              name: "A Motosiklet",
              minimumAge: 18,
              existingLicenseType: null,
              theoryLessonHours: 20,
              directPracticeLessonHours: 10,
              displayOrder: 20,
              isActive: true,
              updatedAtUtc: "2026-01-01T00:00:00Z",
              rowVersion: 1,
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    const response = await getLicenseClassDefinitions({ search: "sinifi", activity: "all" });

    expect(response.items.map((item) => item.name)).toEqual(["D Sınıfı"]);
  });

  it("matches training branch names with accentless queries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              trainingBranchDefinitionId: "branch1",
              code: "theory",
              name: "Teorik Eğitim",
              totalLessonHourLimit: 34,
              colorHex: "#3e5660",
              displayOrder: 10,
              isActive: true,
              updatedAtUtc: "2026-01-01T00:00:00Z",
              rowVersion: 1,
            },
            {
              trainingBranchDefinitionId: "branch2",
              code: "practice",
              name: "Direksiyon",
              totalLessonHourLimit: null,
              colorHex: "#3e5660",
              displayOrder: 20,
              isActive: true,
              updatedAtUtc: "2026-01-01T00:00:00Z",
              rowVersion: 1,
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    const response = await getTrainingBranchDefinitions({ search: "egitim", activity: "all" });

    expect(response.items.map((item) => item.name)).toEqual(["Teorik Eğitim"]);
  });
});
