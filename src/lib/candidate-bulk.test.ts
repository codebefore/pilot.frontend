import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildCandidateUpdatePayload, assignCandidatesToExamDate } from "./candidate-bulk";
import type { CandidateResponse } from "./types";

const candidateApiMocks = vi.hoisted(() => ({
  getCandidateById: vi.fn(),
  updateCandidate: vi.fn(),
}));

const examAttemptApiMocks = vi.hoisted(() => ({
  createCandidateExamAttempt: vi.fn(),
  listCandidateExamAttempts: vi.fn(),
  updateCandidateExamAttempt: vi.fn(),
}));

vi.mock("./candidates-api", () => candidateApiMocks);
vi.mock("./candidate-exam-attempts-api", () => examAttemptApiMocks);

describe("buildCandidateUpdatePayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves license rule identity for bulk updates", () => {
    const candidate = {
      firstName: "Ayse",
      lastName: "Demir",
      nationalId: "12345678910",
      referenceName: null,
      phoneNumber: null,
      birthDate: null,
      gender: null,
      licenseClass: "C",
      licenseClassDefinitionId: "rule-b-to-c",
      hasExistingLicense: true,
      existingLicenseType: "B",
      existingLicenseIssuedAt: null,
      existingLicenseNumber: null,
      existingLicenseIssuedProvince: null,
      existingLicensePre2016: false,
      status: "pre_registered",
      rowVersion: 3,
    } as CandidateResponse;

    const payload = buildCandidateUpdatePayload(candidate, { status: "active" });

    expect(payload.status).toBe("active");
    expect(payload.licenseClassDefinitionId).toBe("rule-b-to-c");
    expect(payload.hasExistingLicense).toBe(true);
    expect(payload.existingLicenseType).toBe("B");
  });

  it("updates the open exam attempt when moving a candidate to another exam schedule", async () => {
    const candidate = {
      id: "candidate-1",
      firstName: "Ayse",
      lastName: "Demir",
      nationalId: "12345678910",
      referenceName: null,
      phoneNumber: null,
      birthDate: null,
      gender: null,
      licenseClass: "B",
      licenseClassDefinitionId: "rule-b",
      hasExistingLicense: false,
      existingLicenseType: null,
      existingLicenseIssuedAt: null,
      existingLicenseNumber: null,
      existingLicenseIssuedProvince: null,
      existingLicensePre2016: false,
      status: "active",
      rowVersion: 3,
    } as CandidateResponse;
    candidateApiMocks.getCandidateById.mockResolvedValue(candidate);
    candidateApiMocks.updateCandidate.mockResolvedValue({ ...candidate, rowVersion: 4 });
    examAttemptApiMocks.listCandidateExamAttempts.mockResolvedValue([
      {
        id: "attempt-1",
        candidateId: "candidate-1",
        examType: "practice",
        scheduledAt: "2026-06-07T09:00:00.000Z",
        attemptNumber: 1,
        score: null,
        expiresAt: null,
        examScheduleId: "old-schedule",
        examCode: "123456789",
        vehicleId: null,
        vehiclePlate: null,
        instructorId: null,
        instructorFullName: null,
        examAttendanceStatus: null,
        examResultStatus: null,
        fee: 0,
        feeStatus: "pending",
        paidAt: null,
        accountingMovementId: null,
        createdAt: "2026-06-07T08:00:00.000Z",
        rowVersion: 5,
      },
    ]);
    examAttemptApiMocks.updateCandidateExamAttempt.mockResolvedValue({});

    const result = await assignCandidatesToExamDate(
      ["candidate-1"],
      "uygulama",
      "2026-06-08",
      "new-schedule",
      "10:00"
    );

    expect(result).toEqual({ successCount: 1, failureCount: 0 });
    expect(examAttemptApiMocks.createCandidateExamAttempt).not.toHaveBeenCalled();
    expect(examAttemptApiMocks.updateCandidateExamAttempt).toHaveBeenCalledWith(
      "candidate-1",
      "attempt-1",
      expect.objectContaining({
        examType: "practice",
        examScheduleId: "new-schedule",
        scheduledAt: "2026-06-08T10:00:00.000Z",
        rowVersion: 5,
      })
    );
  });

  it("does not overwrite a closed absent practice attempt when assigning a new schedule", async () => {
    const candidate = {
      id: "candidate-1",
      firstName: "Ayse",
      lastName: "Demir",
      nationalId: "12345678910",
      referenceName: null,
      phoneNumber: null,
      birthDate: null,
      gender: null,
      licenseClass: "B",
      licenseClassDefinitionId: "rule-b",
      hasExistingLicense: false,
      existingLicenseType: null,
      existingLicenseIssuedAt: null,
      existingLicenseNumber: null,
      existingLicenseIssuedProvince: null,
      existingLicensePre2016: false,
      status: "active",
      rowVersion: 3,
    } as CandidateResponse;
    candidateApiMocks.getCandidateById.mockResolvedValue(candidate);
    candidateApiMocks.updateCandidate.mockResolvedValue({ ...candidate, rowVersion: 4 });
    examAttemptApiMocks.listCandidateExamAttempts.mockResolvedValue([
      {
        id: "attempt-1",
        candidateId: "candidate-1",
        examType: "practice",
        scheduledAt: "2026-06-07T09:00:00.000Z",
        attemptNumber: 1,
        score: null,
        expiresAt: null,
        examScheduleId: "old-schedule",
        examCode: "123456789",
        vehicleId: null,
        vehiclePlate: null,
        instructorId: null,
        instructorFullName: null,
        examAttendanceStatus: "absent",
        examResultStatus: null,
        fee: 0,
        feeStatus: "pending",
        paidAt: null,
        accountingMovementId: null,
        createdAt: "2026-06-07T08:00:00.000Z",
        rowVersion: 5,
      },
    ]);
    examAttemptApiMocks.createCandidateExamAttempt.mockResolvedValue({});

    const result = await assignCandidatesToExamDate(
      ["candidate-1"],
      "uygulama",
      "2026-06-08",
      "new-schedule",
      "10:00"
    );

    expect(result).toEqual({ successCount: 1, failureCount: 0 });
    expect(examAttemptApiMocks.updateCandidateExamAttempt).not.toHaveBeenCalled();
    expect(examAttemptApiMocks.createCandidateExamAttempt).toHaveBeenCalledWith(
      "candidate-1",
      expect.objectContaining({
        examType: "practice",
        examScheduleId: "new-schedule",
        scheduledAt: "2026-06-08T10:00:00.000Z",
      })
    );
  });
});
