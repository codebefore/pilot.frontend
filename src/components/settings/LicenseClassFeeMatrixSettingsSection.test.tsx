import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LicenseClassFeeMatrixResponse } from "../../lib/types";
import { renderWithProviders } from "../../test/render-with-providers";
import {
  LicenseClassFeeMatrixSettingsSection,
  type FeeMatrixMode,
} from "./LicenseClassFeeMatrixSettingsSection";

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

function renderSection(
  auth?: NonNullable<Parameters<typeof renderWithProviders>[1]>["auth"],
  mode: FeeMatrixMode = "institution"
) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/settings/definitions/fees/${mode}`]}>
      <LicenseClassFeeMatrixSettingsSection mode={mode} />
    </MemoryRouter>,
    { auth }
  );
}

function RoutedFeeMatrixSection() {
  const location = useLocation();
  const mode: FeeMatrixMode = location.pathname.endsWith("/contract") ? "contract" : "institution";
  return <LicenseClassFeeMatrixSettingsSection mode={mode} />;
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

  it("keeps fee transition sections collapsed by default", async () => {
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

    const sectionButton = await screen.findByRole(
      "button",
      { name: /Sıfırdan Başlayanlar/ },
      { timeout: 5000 }
    );

    expect(sectionButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Kurs Ücreti")).not.toBeInTheDocument();
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

  it("disables contract fee mutations when payments permission is view-only", async () => {
    renderSection(
      {
        user: {
          id: "finance-viewer",
          phone: "5073737262",
          name: "Finance Viewer",
          roleName: "Finans",
          isSuperAdmin: false,
        },
        permissions: { payments: "view" },
      },
      "contract"
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /Sıfırdan Başlayanlar/ }, { timeout: 5000 })
    );

    expect(
      screen.getByRole("checkbox", {
        name: "Sıfırdan Başlayanlar bölümündeki tüm programları seç",
      })
    ).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Yok → B programını seç" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeDisabled();

    const hourlyInput = screen.getAllByLabelText("Saat KDV'li")[0];
    expect(hourlyInput).toBeDisabled();

    fireEvent.change(hourlyInput, { target: { value: "175" } });
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

  it("shows only institution fee columns on the institution fee page", async () => {
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

    expect(screen.getByRole("link", { name: "Kurum Ücretleri" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("columnheader", { name: "Kurs Ücreti" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "MEBBİS" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Başarısız Hak" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Özel Ders" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Sınav Ücreti" })).toBeInTheDocument();

    expect(screen.queryByRole("columnheader", { name: "Söz. Sınav" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Saat KDV'li" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Söz. Toplam" })).not.toBeInTheDocument();
  });

  it("shows only contract fee columns on the contract fee page", async () => {
    renderSection(
      {
        user: {
          id: "finance-manager",
          phone: "5073737262",
          name: "Finance Manager",
          roleName: "Finans",
          isSuperAdmin: false,
        },
        permissions: { payments: "full" },
      },
      "contract"
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /Sıfırdan Başlayanlar/ }, { timeout: 5000 })
    );

    expect(screen.getByRole("link", { name: "Sözleşme Ücretleri" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("columnheader", { name: "Söz. Sınav" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Saat KDV'li" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "KDV" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Söz. Toplam" })).toBeInTheDocument();

    expect(screen.queryByRole("columnheader", { name: "Kurs Ücreti" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "MEBBİS" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Başarısız Hak" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Özel Ders" })).not.toBeInTheDocument();
  });

  it("saves contract row fee changes from the contract fee page", async () => {
    renderSection(
      {
        user: {
          id: "finance-manager",
          phone: "5073737262",
          name: "Finance Manager",
          roleName: "Finans",
          isSuperAdmin: false,
        },
        permissions: { payments: "full" },
      },
      "contract"
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /Sıfırdan Başlayanlar/ }, { timeout: 5000 })
    );
    const hourlyInputs = screen.getAllByLabelText("Saat KDV'li");
    fireEvent.change(hourlyInputs[0], { target: { value: "175" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateLicenseClassFeeMatrixMock).toHaveBeenCalledWith(
        matrixResponse.year,
        expect.objectContaining({
          rows: expect.arrayContaining([
            expect.objectContaining({
              licenseClassDefinitionId: "program-b",
              lessonType: "theory",
              vatIncludedHourlyRate: 175,
              rowVersion: 5,
            }),
          ]),
        })
      );
    });
  });

  it("keeps hidden dirty fee changes saveable after switching fee pages", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/settings/definitions/fees/institution"]}>
        <Routes>
          <Route
            element={<RoutedFeeMatrixSection />}
            path="/settings/definitions/fees/:mode"
          />
        </Routes>
      </MemoryRouter>,
      {
        auth: {
          user: {
            id: "finance-manager",
            phone: "5073737262",
            name: "Finance Manager",
            roleName: "Finans",
            isSuperAdmin: false,
          },
          permissions: { payments: "full" },
        },
      }
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /Sıfırdan Başlayanlar/ }, { timeout: 5000 })
    );
    fireEvent.change(screen.getByLabelText("Kurs Ücreti"), { target: { value: "1300" } });
    fireEvent.click(screen.getByRole("link", { name: "Sözleşme Ücretleri" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Sözleşme Ücretleri" })).toHaveAttribute(
        "aria-current",
        "page"
      );
    });
    expect(screen.queryByLabelText("Kurs Ücreti")).not.toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: "Kaydet" });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateLicenseClassFeeMatrixMock).toHaveBeenCalledWith(
        matrixResponse.year,
        expect.objectContaining({
          programs: [
            expect.objectContaining({
              licenseClassDefinitionId: "program-b",
              courseFee: 1300,
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
  });
});
