import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CertificateProgramFeeMatrixResponse } from "../../lib/types";
import { renderWithProviders } from "../../test/render-with-providers";
import { CertificateProgramFeeMatrixSettingsSection } from "./CertificateProgramFeeMatrixSettingsSection";

const getCertificateProgramFeeMatrixMock = vi.fn();
const updateCertificateProgramFeeMatrixMock = vi.fn();
const bulkApplyCertificateProgramFeeMatrixMock = vi.fn();

vi.mock("../../lib/certificate-program-fee-matrix-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/certificate-program-fee-matrix-api")>(
    "../../lib/certificate-program-fee-matrix-api"
  );

  return {
    ...actual,
    getCertificateProgramFeeMatrix: (
      ...args: Parameters<typeof actual.getCertificateProgramFeeMatrix>
    ) => getCertificateProgramFeeMatrixMock(...args),
    updateCertificateProgramFeeMatrix: (
      ...args: Parameters<typeof actual.updateCertificateProgramFeeMatrix>
    ) => updateCertificateProgramFeeMatrixMock(...args),
    bulkApplyCertificateProgramFeeMatrix: (
      ...args: Parameters<typeof actual.bulkApplyCertificateProgramFeeMatrix>
    ) => bulkApplyCertificateProgramFeeMatrixMock(...args),
  };
});

const matrixResponse: CertificateProgramFeeMatrixResponse = {
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
      <CertificateProgramFeeMatrixSettingsSection />
    </MemoryRouter>,
    { auth }
  );
}

describe("CertificateProgramFeeMatrixSettingsSection", () => {
  beforeEach(() => {
    getCertificateProgramFeeMatrixMock.mockReset();
    updateCertificateProgramFeeMatrixMock.mockReset();
    bulkApplyCertificateProgramFeeMatrixMock.mockReset();

    getCertificateProgramFeeMatrixMock.mockResolvedValue(matrixResponse);
    updateCertificateProgramFeeMatrixMock.mockResolvedValue(matrixResponse);
    bulkApplyCertificateProgramFeeMatrixMock.mockResolvedValue(matrixResponse);
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

    fireEvent.click(await screen.findByRole("button", { name: /Sıfırdan Başlayanlar/ }));

    expect(screen.getByRole("button", { name: "Toplu seçim" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeDisabled();

    const courseFeeInput = screen.getByLabelText("Kurs Ücreti");
    expect(courseFeeInput).toBeDisabled();
    expect(courseFeeInput).toHaveValue("1000");

    fireEvent.change(courseFeeInput, { target: { value: "1200" } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    expect(updateCertificateProgramFeeMatrixMock).not.toHaveBeenCalled();
    expect(bulkApplyCertificateProgramFeeMatrixMock).not.toHaveBeenCalled();
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

    fireEvent.click(await screen.findByRole("button", { name: /Sıfırdan Başlayanlar/ }));
    const courseFeeInput = screen.getByLabelText("Kurs Ücreti");
    fireEvent.change(courseFeeInput, { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCertificateProgramFeeMatrixMock).toHaveBeenCalledWith(
        matrixResponse.year,
        expect.objectContaining({
          programs: [
            expect.objectContaining({
              certificateProgramId: "program-b",
              courseFee: 1200,
              rowVersion: 3,
            }),
          ],
        })
      );
    });
  });
});
