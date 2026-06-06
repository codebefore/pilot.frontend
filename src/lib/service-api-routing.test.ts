import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("service api routing ownership", () => {
  it("keeps extracted service api modules on their service-specific base urls", () => {
    const expectedImports = [
      ["auth-api.ts", "getAuthApiBaseUrl"],
      ["users-api.ts", "getAuthApiBaseUrl"],
      ["roles-api.ts", "getAuthApiBaseUrl"],
      ["user-notes-api.ts", "getAuthApiBaseUrl"],

      ["candidates-api.ts", "getCandidateApiBaseUrl"],
      ["candidate-k-certificates-api.ts", "getCandidateApiBaseUrl"],
      ["candidate-notes-api.ts", "getCandidateApiBaseUrl"],
      ["candidate-references-api.ts", "getCandidateApiBaseUrl"],

      ["candidate-exam-attempts-api.ts", "getTrainingApiBaseUrl"],
      ["classrooms-api.ts", "getTrainingApiBaseUrl"],
      ["exam-codes-api.ts", "getTrainingApiBaseUrl"],
      ["exam-schedules-api.ts", "getTrainingApiBaseUrl"],
      ["groups-api.ts", "getTrainingApiBaseUrl"],
      ["instructor-assignments-api.ts", "getTrainingApiBaseUrl"],
      ["instructors-api.ts", "getTrainingApiBaseUrl"],
      ["terms-api.ts", "getTrainingApiBaseUrl"],
      ["training-lessons-api.ts", "getTrainingApiBaseUrl"],
      ["vehicles-api.ts", "getTrainingApiBaseUrl"],

      ["documents-api.ts", "getDocumentApiBaseUrl"],
      ["instructor-assignments-api.ts", "getDocumentApiBaseUrl"],
      ["vehicle-documents-api.ts", "getDocumentApiBaseUrl"],

      ["candidate-accounting-api.ts", "getFinanceApiBaseUrl"],
      ["cash-registers-api.ts", "getFinanceApiBaseUrl"],
      ["license-class-fee-matrix-api.ts", "getFinanceApiBaseUrl"],
      ["payments-api.ts", "getFinanceApiBaseUrl"],

      ["license-class-definitions-api.ts", "getCatalogApiBaseUrl"],
      ["training-branch-definitions-api.ts", "getCatalogApiBaseUrl"],
      ["documents-api.ts", "getCatalogApiBaseUrl"],

      ["mebbis-jobs-api.ts", "getMebbisApiBaseUrl"],

      ["institution-settings-api.ts", "getPlatformApiBaseUrl"],
      ["notifications-api.ts", "getPlatformApiBaseUrl"],
      ["outbox-api.ts", "getPlatformApiBaseUrl"],
      ["stats-api.ts", "getPlatformApiBaseUrl"],
    ];

    for (const [fileName, helperName] of expectedImports) {
      const source = readFileSync(resolve("src/lib", fileName), "utf8");
      expect(source, `${fileName} should use ${helperName}`).toContain(helperName);
    }
  });

  it("keeps catalog document type calls on the catalog service base", () => {
    const source = readFileSync(resolve("src/lib/documents-api.ts"), "utf8");

    expect(source).toContain('"/api/catalog/document-types"');
    expect(source).toContain('httpPost<DocumentTypeSnapshot>(');
    expect(source).toContain('httpPut<DocumentTypeSnapshot>(');
  });

  it("keeps instructor photo rendering on the training service base", () => {
    const source = readFileSync(resolve("src/components/ui/InstructorAvatar.tsx"), "utf8");

    expect(source).toContain("getTrainingApiBaseUrl");
    expect(source).toContain("/api/training/instructors/");
  });
});
