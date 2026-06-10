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

  it("creates a new theory attempt when assigning a candidate to another e-exam schedule", async () => {
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
    candidateApiMocks.updateCandidate.mockResolvedValue({ ...candidate, eSinavAttemptCount: 2, rowVersion: 4 });
    examAttemptApiMocks.listCandidateExamAttempts.mockResolvedValue([
      {
        id: "attempt-1",
        candidateId: "candidate-1",
        examType: "theory",
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
    examAttemptApiMocks.createCandidateExamAttempt.mockResolvedValue({
      id: "attempt-2",
      candidateId: "candidate-1",
      examType: "theory",
      scheduledAt: "2026-06-08T07:00:00.000Z",
      attemptNumber: 2,
      score: null,
      expiresAt: null,
      examScheduleId: "new-schedule",
      examCode: null,
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
      rowVersion: 1,
    });

    const result = await assignCandidatesToExamDate(
      ["candidate-1"],
      "e_sinav",
      "2026-06-08",
      "new-schedule",
      "10:00"
    );

    expect(result).toEqual({
      successCount: 1,
      failureCount: 0,
      assignedCandidates: [
        {
          candidate: expect.objectContaining({
            id: "candidate-1",
            eSinavAttemptCount: 2,
          }),
          attempt: expect.objectContaining({
            id: "attempt-2",
            examScheduleId: "new-schedule",
          }),
        },
      ],
    });
    expect(examAttemptApiMocks.updateCandidateExamAttempt).not.toHaveBeenCalled();
    expect(examAttemptApiMocks.createCandidateExamAttempt).toHaveBeenCalledWith(
      "candidate-1",
      expect.objectContaining({
        examType: "theory",
        examScheduleId: "new-schedule",
        scheduledAt: "2026-06-08T07:00:00.000Z",
        attemptNumber: 2,
      })
    );
    expect(candidateApiMocks.updateCandidate).toHaveBeenCalledWith(
      "candidate-1",
      expect.objectContaining({
        mebExamDate: "2026-06-08",
        eSinavAttemptCount: 2,
      })
    );
  });

  it("does not create a fifth theory attempt when all e-exam rights are used", async () => {
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
    examAttemptApiMocks.listCandidateExamAttempts.mockResolvedValue(
      [1, 2, 3, 4].map((attemptNumber) => ({
        id: `attempt-${attemptNumber}`,
        candidateId: "candidate-1",
        examType: "theory",
        scheduledAt: `2026-06-0${attemptNumber}T09:00:00.000Z`,
        attemptNumber,
        score: null,
        expiresAt: null,
        examScheduleId: `schedule-${attemptNumber}`,
        examCode: null,
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
        createdAt: `2026-06-0${attemptNumber}T08:00:00.000Z`,
        rowVersion: attemptNumber,
      }))
    );

    const result = await assignCandidatesToExamDate(
      ["candidate-1"],
      "e_sinav",
      "2026-06-08",
      "new-schedule",
      "10:00"
    );

    expect(result).toEqual({
      successCount: 0,
      failureCount: 1,
      assignedCandidates: [],
    });
    expect(examAttemptApiMocks.createCandidateExamAttempt).not.toHaveBeenCalled();
    expect(examAttemptApiMocks.updateCandidateExamAttempt).not.toHaveBeenCalled();
    expect(candidateApiMocks.updateCandidate).not.toHaveBeenCalled();
  });

  it("creates a new practice attempt and updates the candidate attempt count when assigning another schedule", async () => {
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
    candidateApiMocks.updateCandidate.mockResolvedValue({ ...candidate, drivingExamAttemptCount: 2, rowVersion: 4 });
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
    examAttemptApiMocks.createCandidateExamAttempt.mockResolvedValue({
      id: "attempt-2",
      candidateId: "candidate-1",
      examType: "practice",
      scheduledAt: "2026-06-08T07:00:00.000Z",
      attemptNumber: 2,
      score: null,
      expiresAt: null,
      examScheduleId: "new-schedule",
      examCode: null,
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
      rowVersion: 1,
    });

    const result = await assignCandidatesToExamDate(
      ["candidate-1"],
      "uygulama",
      "2026-06-08",
      "new-schedule",
      "10:00"
    );

    expect(result).toEqual({
      successCount: 1,
      failureCount: 0,
      assignedCandidates: [
        {
          candidate: expect.objectContaining({
            id: "candidate-1",
            drivingExamAttemptCount: 2,
          }),
          attempt: expect.objectContaining({
            id: "attempt-2",
            examScheduleId: "new-schedule",
          }),
        },
      ],
    });
    expect(examAttemptApiMocks.updateCandidateExamAttempt).not.toHaveBeenCalled();
    expect(examAttemptApiMocks.createCandidateExamAttempt).toHaveBeenCalledWith(
      "candidate-1",
      expect.objectContaining({
        examType: "practice",
        examScheduleId: "new-schedule",
        scheduledAt: "2026-06-08T07:00:00.000Z",
        attemptNumber: 2,
      })
    );
    expect(candidateApiMocks.updateCandidate).toHaveBeenCalledWith(
      "candidate-1",
      expect.objectContaining({
        drivingExamDate: "2026-06-08",
        drivingExamScheduleId: "new-schedule",
        drivingExamAttemptCount: 2,
      })
    );
  });
});
