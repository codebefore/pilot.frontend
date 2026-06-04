import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyRuntimeConfig } from "./api";
import {
  chargeCandidateExamAttempt,
  createCandidateExamAttempt,
  deleteCandidateExamAttempt,
  listCandidateExamAttempts,
  markCandidateExamAttemptSelfPaid,
  updateCandidateExamAttempt,
} from "./candidate-exam-attempts-api";
import { getClassrooms } from "./classrooms-api";
import { getExamCodes } from "./exam-codes-api";
import { createExamSchedule } from "./exam-schedules-api";
import { getGroups } from "./groups-api";
import { createAssignment, listAssignments } from "./instructor-assignments-api";
import { getInstructors } from "./instructors-api";
import { getTerms } from "./terms-api";
import { createTrainingLesson, deleteTrainingLessonsByGroup } from "./training-lessons-api";
import { getVehicles } from "./vehicles-api";

describe("training api routing", () => {
  beforeEach(() => {
    applyRuntimeConfig(undefined);
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );
  });

  it("routes term, group, exam, and resource reads to the runtime training base url", async () => {
    applyRuntimeConfig({ trainingApiBaseUrl: "http://127.0.0.1:5095" });

    await getTerms({ page: 1, pageSize: 20 });
    await getGroups({ search: "A", page: 2 });
    await getExamCodes("uygulama");
    await getClassrooms({ activity: "active", pageSize: 50 });
    await getInstructors({ activity: "all", role: "master_instructor" });
    await getVehicles({ activity: "all", status: "idle" });

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5095/api/training/terms?page=1&pageSize=20"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5095/api/training/groups?search=A&page=2"
    );
    expect(String(vi.mocked(fetch).mock.calls[2][0])).toBe(
      "http://127.0.0.1:5095/api/training/exam-codes?examType=uygulama"
    );
    expect(String(vi.mocked(fetch).mock.calls[3][0])).toBe(
      "http://127.0.0.1:5095/api/training/classrooms?activity=active&pageSize=50"
    );
    expect(String(vi.mocked(fetch).mock.calls[4][0])).toBe(
      "http://127.0.0.1:5095/api/training/instructors?includeInactive=false&activity=all&role=master_instructor"
    );
    expect(String(vi.mocked(fetch).mock.calls[5][0])).toBe(
      "http://127.0.0.1:5095/api/training/vehicles?includeInactive=false&activity=all&status=idle"
    );
  });

  it("routes schedule, lesson, and assignment commands to the runtime training base url", async () => {
    applyRuntimeConfig({ trainingApiBaseUrl: "http://127.0.0.1:5095" });

    await createExamSchedule({
      examType: "uygulama",
      date: "2026-06-01",
      capacity: 20,
    });
    await createTrainingLesson({
      kind: "uygulama",
      status: "planned",
      instructorId: "instructor-1",
      candidateId: "candidate-1",
      startAtUtc: "2026-06-01T10:00:00Z",
      endAtUtc: "2026-06-01T11:00:00Z",
    });
    await deleteTrainingLessonsByGroup("group-1");
    await listAssignments("instructor-1");
    await createAssignment("instructor-1", {
      role: "master_instructor",
      employmentType: "salaried",
      branches: ["practice"],
      licenseClassCodes: ["B"],
      mebPermitNo: null,
      contractStartDate: "2026-06-01",
      contractEndDate: null,
      weeklyLessonHours: 20,
    });

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5095/api/training/exam-schedules"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5095/api/training/lessons"
    );
    expect(String(vi.mocked(fetch).mock.calls[2][0])).toBe(
      "http://127.0.0.1:5095/api/training/lessons/bulk?groupId=group-1"
    );
    expect(String(vi.mocked(fetch).mock.calls[3][0])).toBe(
      "http://127.0.0.1:5095/api/training/instructors/instructor-1/assignments"
    );
    expect(String(vi.mocked(fetch).mock.calls[4][0])).toBe(
      "http://127.0.0.1:5095/api/training/instructors/instructor-1/assignments"
    );
  });

  it("routes candidate exam attempt calls to the runtime training base url", async () => {
    applyRuntimeConfig({ trainingApiBaseUrl: "http://127.0.0.1:5095" });

    await listCandidateExamAttempts("candidate-1");
    await createCandidateExamAttempt("candidate-1", {
      examType: "theory",
      attemptNumber: 1,
      scheduledAt: "2026-06-01",
      examResultStatus: "passed",
      score: 80,
      fee: 0,
      feeStatus: "pending",
      examScheduleId: null,
    });
    await updateCandidateExamAttempt("candidate-1", "attempt-1", {
      examType: "theory",
      attemptNumber: 1,
      scheduledAt: "2026-06-01",
      examResultStatus: "failed",
      score: 40,
      fee: 0,
      feeStatus: "pending",
      examScheduleId: null,
    });
    await chargeCandidateExamAttempt("candidate-1", "attempt-1");
    await markCandidateExamAttemptSelfPaid("candidate-1", "attempt-1");
    await deleteCandidateExamAttempt("candidate-1", "attempt-1");

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5095/api/training/candidates/candidate-1/exam-attempts"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5095/api/training/candidates/candidate-1/exam-attempts"
    );
    expect(String(vi.mocked(fetch).mock.calls[2][0])).toBe(
      "http://127.0.0.1:5095/api/training/candidates/candidate-1/exam-attempts/attempt-1"
    );
    expect(String(vi.mocked(fetch).mock.calls[3][0])).toBe(
      "http://127.0.0.1:5095/api/training/candidates/candidate-1/exam-attempts/attempt-1/charge"
    );
    expect(String(vi.mocked(fetch).mock.calls[4][0])).toBe(
      "http://127.0.0.1:5095/api/training/candidates/candidate-1/exam-attempts/attempt-1/mark-self-paid"
    );
    expect(String(vi.mocked(fetch).mock.calls[5][0])).toBe(
      "http://127.0.0.1:5095/api/training/candidates/candidate-1/exam-attempts/attempt-1"
    );
  });

  it("normalizes candidate exam attempt calls for the production v1 training gateway base", async () => {
    applyRuntimeConfig({ trainingApiBaseUrl: "https://apipilot.virabyte.tr/v1/training" });

    await listCandidateExamAttempts("candidate-1");

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "https://apipilot.virabyte.tr/v1/training/candidates/candidate-1/exam-attempts"
    );
  });
});
