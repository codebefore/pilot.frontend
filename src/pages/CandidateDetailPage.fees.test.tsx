import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import type {
  CandidateAccountingSummaryResponse,
  CandidateResponse,
  LicenseClassFeeMatrixResponse,
} from "../lib/types";
import { AccountingMovementSection, CandidateHero } from "./CandidateDetailPage";

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
  practiceFee: number | null,
  courseFee: number | null = null
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
    courseFee,
    mebbisFee: null,
    failureRetryFee: null,
    privateLessonFee: null,
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
        vatIncludedHourlyRate: null,
        vatExcludedHourlyRate: null,
        lessonFee: null,
        vatAmount: null,
        contractTheoryExamFee: null,
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
        vatIncludedHourlyRate: null,
        vatExcludedHourlyRate: null,
        lessonFee: null,
        vatAmount: null,
        contractTheoryExamFee: null,
        contractPracticeExamFee: null,
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

  it("shows the strip only when all default fees are empty", async () => {
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
    expect(within(dialog).getByLabelText("KURS Ü.")).toHaveValue("");

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

  it("hides the strip when a course fee exists", async () => {
    mocks.getFeeMatrix.mockResolvedValue(feeMatrix(null, null, 15000));
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
    mocks.updateFeeMatrix.mockResolvedValue(feeMatrix(1250, null));
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
        }),
        { licenseClassDefinitionId: programId }
      );
      expect(mocks.getFeeMatrix).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Ehliyet Tipi Ücret Önerileri Boş!")).not.toBeInTheDocument();
    });
  });
});

describe("AccountingMovementSection", () => {
  it("shows no payment date on a debt row", () => {
    const movement: CandidateAccountingSummaryResponse["movements"][number] = {
      id: "movement-1",
      candidateId: "candidate-1",
      type: "kurs",
      number: "BR-1",
      description: "Kurs borcu",
      dueDate: "2026-07-20",
      amount: 1000,
      paidAmount: 0,
      refundedAmount: 0,
      remainingAmount: 1000,
      status: "active",
      lastPaymentMethod: null,
      lastPaidAtUtc: null,
      cancelledAtUtc: null,
      cancellationReason: null,
      createdAtUtc: "2026-07-15T10:30:00Z",
      updatedAtUtc: "2026-07-15T10:30:00Z",
      rowVersion: 1,
    };

    renderWithProviders(
      <AccountingMovementSection
        canManagePayments
        movements={[movement]}
        onCancelMovement={vi.fn()}
        onCancelPayment={vi.fn()}
        onCreateInvoice={vi.fn()}
        onOpenReceipt={vi.fn()}
        onOpenRefund={vi.fn()}
        onPay={vi.fn()}
        payments={[]}
        refunds={[]}
        title="Borç tarihi testi"
      />
    );

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    const paymentDateColumnIndex = headers.findIndex((header) =>
      within(header).queryByText("Ödeme Tarihi")
    );
    const debtRow = within(table).getAllByRole("row")[1];
    const cells = within(debtRow).getAllByRole("cell");

    expect(paymentDateColumnIndex).toBeGreaterThanOrEqual(0);
    expect(cells[paymentDateColumnIndex]).toHaveTextContent("—");
    expect(cells[paymentDateColumnIndex]).not.toHaveTextContent("15.07.2026");
  });
});
