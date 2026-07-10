import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import type { CandidateResponse, LicenseClassFeeMatrixResponse } from "../lib/types";
import { CandidateHero } from "./CandidateDetailPage";

const mocks = vi.hoisted(() => ({
  getFeeMatrix: vi.fn(),
  updateFeeMatrix: vi.fn(),
}));
const programId = "11111111-1111-1111-1111-111111111111";

vi.mock("../lib/license-class-fee-matrix-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/license-class-fee-matrix-api")>(
    "../lib/license-class-fee-matrix-api"
  );
  return {
    ...actual,
    getLicenseClassFeeMatrix: (...args: unknown[]) => mocks.getFeeMatrix(...args),
    updateLicenseClassFeeMatrix: (...args: unknown[]) => mocks.updateFeeMatrix(...args),
  };
});

vi.mock("../lib/institution-settings-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/institution-settings-api")>(
    "../lib/institution-settings-api"
  );
  return {
    ...actual,
    getInstitutionSettings: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("../lib/instructors-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/instructors-api")>(
    "../lib/instructors-api"
  );
  return {
    ...actual,
    getInstructors: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 1, totalCount: 0, totalPages: 0 }),
  };
});

vi.mock("../lib/queries/use-mebbis-session", () => ({
  useMebbisSessionGuard: () => ({ disabled: false, message: "", ensureReady: vi.fn() }),
}));

const candidate = {
  id: "candidate-1",
  firstName: "Ada",
  lastName: "Yılmaz",
  licenseClass: "B",
  licenseClassDefinitionId: programId,
  hasExistingLicense: true,
  existingLicenseType: "A2",
  existingLicenseIssuedAt: null,
  existingLicenseNumber: null,
  existingLicenseIssuedProvince: null,
  existingLicensePre2016: false,
  nationalId: "10000000146",
  birthDate: null,
  birthPlace: null,
  gender: null,
  status: "pre_registered",
  currentGroup: null,
  tags: [],
  createdAtUtc: "2026-07-10T10:00:00Z",
  updatedAtUtc: "2026-07-10T10:00:00Z",
} as unknown as CandidateResponse;

function feeMatrix(
  theoryFee: number | null,
  practiceFee: number | null
): LicenseClassFeeMatrixResponse {
  const program = {
    id: programId,
    code: "A2-B",
    sourceLicenseClass: "A2",
    sourceLicenseDisplayName: "A2",
    sourceLicensePre2016: false,
    targetLicenseClass: "B",
    targetLicenseDisplayName: "B",
    minimumAge: 18,
    theoryLessonHours: 34,
    practiceLessonHours: 14,
    courseFee: 15000,
    mebbisFee: 1200,
    failureRetryFee: 2500,
    privateLessonFee: 900,
    educationFee: 777,
    otherFee1: 888,
    yearFeeRowVersion: 7,
  };
  return {
    year: 2026,
    vatRate: 10,
    rows: [
      {
        id: "theory-row",
        year: 2026,
        program,
        lessonType: "theory",
        lessonHours: 34,
        vatIncludedHourlyRate: 100,
        vatExcludedHourlyRate: null,
        lessonFee: null,
        vatAmount: null,
        contractTheoryExamFee: 600,
        contractPracticeExamFee: null,
        institutionTheoryExamFee: theoryFee,
        institutionPracticeExamFee: null,
        rowVersion: 3,
      },
      {
        id: "practice-row",
        year: 2026,
        program,
        lessonType: "practice",
        lessonHours: 14,
        vatIncludedHourlyRate: 200,
        vatExcludedHourlyRate: null,
        lessonFee: null,
        vatAmount: null,
        contractTheoryExamFee: null,
        contractPracticeExamFee: 700,
        institutionTheoryExamFee: null,
        institutionPracticeExamFee: practiceFee,
        rowVersion: 4,
      },
    ],
  };
}

function renderHero(canManagePayments = true) {
  return renderWithProviders(
    <CandidateHero
      accounting={null}
      age={null}
      candidate={candidate}
      canManagePayments={canManagePayments}
    />
  );
}

describe("CandidateHero default fee warning", () => {
  beforeEach(() => {
    mocks.getFeeMatrix.mockReset();
    mocks.updateFeeMatrix.mockReset();
  });

  it("shows the strip only when both institution exam fees are empty", async () => {
    mocks.getFeeMatrix.mockResolvedValue(feeMatrix(null, null));
    renderHero();
    expect(await screen.findByRole("button", { name: "Ehliyet Tipi Ücret Önerileri Boş!" })).toBeInTheDocument();
    expect(mocks.getFeeMatrix).toHaveBeenCalledWith(
      2026,
      {
        targetLicenseClass: "B",
        licenseClassDefinitionId: programId,
      },
      expect.any(AbortSignal)
    );

    fireEvent.click(screen.getByRole("button", { name: "Ehliyet Tipi Ücret Önerileri Boş!" }));
    const dialog = screen.getByRole("dialog", { name: "VARSAYILAN ÜCRET GİRİŞLERİ" });
    expect(within(dialog).getByText("A2")).toBeInTheDocument();
    expect(within(dialog).getByText("B")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("15000")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "VARSAYILAN ÜCRET GİRİŞLERİ" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "DAHA SONRA" }));
    expect(screen.queryByRole("dialog", { name: "VARSAYILAN ÜCRET GİRİŞLERİ" })).not.toBeInTheDocument();
  });

  it("hides the strip when either institution exam fee exists", async () => {
    mocks.getFeeMatrix.mockResolvedValue(feeMatrix(0, null));
    renderHero();
    await waitFor(() => expect(mocks.getFeeMatrix).toHaveBeenCalled());
    expect(screen.queryByText("Ehliyet Tipi Ücret Önerileri Boş!")).not.toBeInTheDocument();
  });

  it("does not show an actionable warning when the selected fee program is missing", async () => {
    mocks.getFeeMatrix.mockResolvedValue({ year: 2026, vatRate: 10, rows: [] });
    renderHero();
    await waitFor(() => expect(mocks.getFeeMatrix).toHaveBeenCalled());
    expect(screen.queryByText("Ehliyet Tipi Ücret Önerileri Boş!")).not.toBeInTheDocument();
  });

  it("saves the full selected scenario without clearing hidden program fields", async () => {
    const matrix = feeMatrix(null, null);
    mocks.getFeeMatrix.mockResolvedValue(matrix);
    mocks.updateFeeMatrix.mockResolvedValue(matrix);
    renderHero();

    fireEvent.click(await screen.findByRole("button", { name: "Ehliyet Tipi Ücret Önerileri Boş!" }));
    fireEvent.change(screen.getByLabelText("TEORİK SINAV Ü."), { target: { value: "1.250" } });
    fireEvent.click(screen.getByRole("button", { name: "KAYDET" }));

    await waitFor(() => {
      expect(mocks.updateFeeMatrix).toHaveBeenCalledWith(
        2026,
        expect.objectContaining({
          rows: expect.arrayContaining([
            expect.objectContaining({
              licenseClassDefinitionId: programId,
              lessonType: "theory",
              institutionTheoryExamFee: 1250,
            }),
          ]),
          programs: [expect.objectContaining({
            licenseClassDefinitionId: programId,
            educationFee: 777,
            otherFee1: 888,
            rowVersion: 7,
          })],
        })
      );
    });
  });
});
