import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LicenseClassFeeMatrixResponse } from "../../lib/types";
import { renderWithProviders } from "../../test/render-with-providers";
import { LicenseClassFeeMatrixSettingsSection } from "./LicenseClassFeeMatrixSettingsSection";

const getLicenseClassFeeMatrixMock = vi.fn();
const updateLicenseClassFeeMatrixMock = vi.fn();
const bulkApplyLicenseClassFeeMatrixMock = vi.fn();

vi.mock("../../lib/license-class-fee-matrix-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/license-class-fee-matrix-api")>(
    "../../lib/license-class-fee-matrix-api"
  );

  return {
    ...actual,
    getLicenseClassFeeMatrix: (
      ...args: Parameters<typeof actual.getLicenseClassFeeMatrix>
    ) => getLicenseClassFeeMatrixMock(...args),
    updateLicenseClassFeeMatrix: (
      ...args: Parameters<typeof actual.updateLicenseClassFeeMatrix>
    ) => updateLicenseClassFeeMatrixMock(...args),
    bulkApplyLicenseClassFeeMatrix: (
      ...args: Parameters<typeof actual.bulkApplyLicenseClassFeeMatrix>
    ) => bulkApplyLicenseClassFeeMatrixMock(...args),
  };
});

const matrixResponse: LicenseClassFeeMatrixResponse = {
  year: new Date().getFullYear(),
  vatRate: 0.1,
  rows: [
    {
      id: "fee-row-theory",
      year: new Date().getFullYear(),
      program: {
        id: "program-b",
        code: "YOK-B",
        sourceLicenseClass: "YOK",
        sourceLicenseDisplayName: "Yok",
        sourceLicensePre2016: false,
        targetLicenseClass: "B",
        targetLicenseDisplayName: "B",
        minimumAge: 18,
        theoryLessonHours: 34,
        practiceLessonHours: 14,
        courseFee: 1000,
        mebbisFee: 200,
        failureRetryFee: null,
        privateLessonFee: null,
        educationFee: null,
        otherFee1: null,
        yearFeeRowVersion: 3,
      },
      lessonType: "theory",
      lessonHours: 34,
      vatIncludedHourlyRate: 100,
      vatExcludedHourlyRate: null,
      lessonFee: null,
      vatAmount: null,
      contractTheoryExamFee: 50,
      contractPracticeExamFee: null,
      institutionTheoryExamFee: 40,
      institutionPracticeExamFee: null,
      rowVersion: 5,
    },
    {
      id: "fee-row-practice",
      year: new Date().getFullYear(),
      program: {
        id: "program-b",
        code: "YOK-B",
        sourceLicenseClass: "YOK",
        sourceLicenseDisplayName: "Yok",
        sourceLicensePre2016: false,
        targetLicenseClass: "B",
        targetLicenseDisplayName: "B",
        minimumAge: 18,
        theoryLessonHours: 34,
        practiceLessonHours: 14,
        courseFee: 1000,
        mebbisFee: 200,
        failureRetryFee: null,
        privateLessonFee: null,
        educationFee: null,
        otherFee1: null,
        yearFeeRowVersion: 3,
      },
      lessonType: "practice",
      lessonHours: 14,
      vatIncludedHourlyRate: 150,
      vatExcludedHourlyRate: null,
      lessonFee: null,
      vatAmount: null,
      contractTheoryExamFee: null,
      contractPracticeExamFee: 75,
      institutionTheoryExamFee: null,
      institutionPracticeExamFee: 60,
      rowVersion: 6,
    },
  ],
};

function renderSection(auth?: NonNullable<Parameters<typeof renderWithProviders>[1]>["auth"]) {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/settings/definitions/fee-matrix"]}>
      <LicenseClassFeeMatrixSettingsSection />
    </MemoryRouter>,
    { auth }
  );
}

describe("LicenseClassFeeMatrixSettingsSection", () => {
  beforeEach(() => {
    getLicenseClassFeeMatrixMock.mockReset();
    updateLicenseClassFeeMatrixMock.mockReset();
    bulkApplyLicenseClassFeeMatrixMock.mockReset();

    getLicenseClassFeeMatrixMock.mockResolvedValue(matrixResponse);
    updateLicenseClassFeeMatrixMock.mockResolvedValue(matrixResponse);
    bulkApplyLicenseClassFeeMatrixMock.mockResolvedValue(matrixResponse);
  });

  it("disables fee mutations when payments permission is view-only", async () => {
    renderSection({
      user: {
        id: "finance-viewer",
        phone: "5073737262",
        name: "Finance Viewer",
        roleName: "Finans",
        isSuperAdmin: false,
      },
      permissions: { payments: "view" },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: /Sıfırdan Başlayanlar/ }, { timeout: 5000 })
    );

    expect(screen.queryByRole("button", { name: "Toplu seçim" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: "Sıfırdan Başlayanlar bölümündeki tüm programları seç",
      })
    ).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Yok → B programını seç" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeDisabled();

    const courseFeeInput = screen.getByLabelText("Kurs Ücreti");
    expect(courseFeeInput).toBeDisabled();
    expect(courseFeeInput).toHaveValue("1000");

    fireEvent.change(courseFeeInput, { target: { value: "1200" } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    expect(updateLicenseClassFeeMatrixMock).not.toHaveBeenCalled();
    expect(bulkApplyLicenseClassFeeMatrixMock).not.toHaveBeenCalled();
  });

  it("allows users with payments full permission to save fee changes", async () => {
    renderSection({
      user: {
        id: "finance-manager",
        phone: "5073737262",
        name: "Finance Manager",
        roleName: "Finans",
        isSuperAdmin: false,
      },
      permissions: { payments: "full" },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: /Sıfırdan Başlayanlar/ }, { timeout: 5000 })
    );
    const courseFeeInput = screen.getByLabelText("Kurs Ücreti");
    fireEvent.change(courseFeeInput, { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateLicenseClassFeeMatrixMock).toHaveBeenCalledWith(
        matrixResponse.year,
        expect.objectContaining({
          programs: [
            expect.objectContaining({
              licenseClassDefinitionId: "program-b",
              courseFee: 1200,
              rowVersion: 3,
            }),
          ],
        })
      );
    });
  });

  it("renders missing institution fees as empty inputs instead of zero", async () => {
    const emptyFeeResponse: LicenseClassFeeMatrixResponse = {
      ...matrixResponse,
      rows: matrixResponse.rows.map((row) => ({
        ...row,
        id: null,
        program: {
          ...row.program,
          courseFee: null,
          mebbisFee: null,
          failureRetryFee: null,
          privateLessonFee: null,
          yearFeeRowVersion: null,
        },
        vatIncludedHourlyRate: null,
        contractTheoryExamFee: null,
        contractPracticeExamFee: null,
        institutionTheoryExamFee: null,
        institutionPracticeExamFee: null,
        rowVersion: null,
      })),
    };
    getLicenseClassFeeMatrixMock.mockResolvedValue(emptyFeeResponse);

    renderSection({
      user: {
        id: "finance-manager",
        phone: "5073737262",
        name: "Finance Manager",
        roleName: "Finans",
        isSuperAdmin: false,
      },
      permissions: { payments: "full" },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: /Sıfırdan Başlayanlar/ }, { timeout: 5000 })
    );

    expect(screen.getByLabelText("Kurs Ücreti")).toHaveValue("");
    expect(screen.getAllByLabelText("Saat KDV'li")[0]).toHaveValue("");
  });
});
