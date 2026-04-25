import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/http";
import { renderWithProviders } from "../../test/render-with-providers";
import { LicenseClassDefinitionsSettingsSection } from "./LicenseClassDefinitionsSettingsSection";

const getLicenseClassDefinitionsMock = vi.fn();
const createLicenseClassDefinitionMock = vi.fn();
const updateLicenseClassDefinitionMock = vi.fn();
const deleteLicenseClassDefinitionMock = vi.fn();

vi.mock("../../lib/license-class-definitions-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/license-class-definitions-api")>(
    "../../lib/license-class-definitions-api"
  );

  return {
    ...actual,
    getLicenseClassDefinitions: (
      ...args: Parameters<typeof actual.getLicenseClassDefinitions>
    ) => getLicenseClassDefinitionsMock(...args),
    createLicenseClassDefinition: (
      ...args: Parameters<typeof actual.createLicenseClassDefinition>
    ) => createLicenseClassDefinitionMock(...args),
    updateLicenseClassDefinition: (
      ...args: Parameters<typeof actual.updateLicenseClassDefinition>
    ) => updateLicenseClassDefinitionMock(...args),
    deleteLicenseClassDefinition: (
      ...args: Parameters<typeof actual.deleteLicenseClassDefinition>
    ) => deleteLicenseClassDefinitionMock(...args),
  };
});

const sampleLicenseClass = {
  id: "lc1",
  code: "B",
  name: "B Otomobil",
  category: "automobile" as const,
  minimumAge: 18,
  isAutomatic: false,
  isDisabled: false,
  isNewGeneration: false,
  requiresTheoryExam: true,
  requiresPracticeExam: true,
  theoryLessonHours: 34,
  contractLessonHours: 16,
  directPracticeLessonHours: 14,
  upgradePracticeLessonHours: 7,
  courseFee: 25000,
  mebbisFee: 1500,
  theoryExamFee: 750,
  practiceExamFirstFee: 1200,
  practiceExamRepeatFee: 1200,
  additionalPracticeLessonFee: 2000,
  otherFee: null,
  displayOrder: 20,
  isActive: true,
  notes: null,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
  rowVersion: 1,
};

describe("LicenseClassDefinitionsSettingsSection", () => {
  beforeEach(() => {
    localStorage.clear();
    getLicenseClassDefinitionsMock.mockReset();
    createLicenseClassDefinitionMock.mockReset();
    updateLicenseClassDefinitionMock.mockReset();
    deleteLicenseClassDefinitionMock.mockReset();

    getLicenseClassDefinitionsMock.mockResolvedValue({
      items: [sampleLicenseClass],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
      summary: {
        activeCount: 1,
        automaticCount: 0,
        disabledCount: 0,
        pricedCount: 1,
      },
    });
    createLicenseClassDefinitionMock.mockResolvedValue({
      ...sampleLicenseClass,
      id: "lc2",
      code: "A2",
      name: "A2 Motosiklet",
      category: "motorcycle",
    });
    updateLicenseClassDefinitionMock.mockResolvedValue({
      ...sampleLicenseClass,
      name: "B Otomobil Yeni",
    });
    deleteLicenseClassDefinitionMock.mockResolvedValue(undefined);
  });

  it("loads only active license classes on mount", async () => {
    renderWithProviders(<LicenseClassDefinitionsSettingsSection />);

    await waitFor(() => {
      expect(getLicenseClassDefinitionsMock).toHaveBeenCalledWith(
        { activity: "active", page: 1, pageSize: 10, search: undefined },
        expect.any(AbortSignal)
      );
    });

    expect(await screen.findByText("B")).toBeInTheDocument();
    expect(screen.getByText("B Otomobil")).toBeInTheDocument();
    expect(screen.getByText("Otomobil")).toBeInTheDocument();
    expect(screen.getByText(/Teo\. 34/)).toBeInTheDocument();
  });

  it("applies filters and re-fetches", async () => {
    renderWithProviders(<LicenseClassDefinitionsSettingsSection />);
    await waitFor(() => expect(getLicenseClassDefinitionsMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Genel Durum filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Pasif" }));

    fireEvent.click(screen.getByRole("button", { name: "Kategori filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Motosiklet" }));

    await waitFor(() => {
      expect(getLicenseClassDefinitionsMock).toHaveBeenLastCalledWith(
        {
          activity: "inactive",
          category: "motorcycle",
          page: 1,
          pageSize: 10,
          search: undefined,
        },
        expect.any(AbortSignal)
      );
    });
  });

  it("submits canonical payload when creating", async () => {
    renderWithProviders(<LicenseClassDefinitionsSettingsSection />);
    await waitFor(() => expect(getLicenseClassDefinitionsMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Yeni Ehliyet Tipi/i }));

    fireEvent.change(screen.getByPlaceholderText("B"), {
      target: { value: " a2 " },
    });
    expect(screen.getByPlaceholderText("B")).toHaveValue(" A2 ");
    fireEvent.change(screen.getByPlaceholderText("B Otomobil"), {
      target: { value: "A2 Motosiklet" },
    });
    fireEvent.change(screen.getByDisplayValue("Otomobil"), {
      target: { value: "motorcycle" },
    });
    fireEvent.change(screen.getByPlaceholderText("18"), {
      target: { value: "16" },
    });
    fireEvent.change(screen.getByLabelText("Teorik Ders Saati"), {
      target: { value: "34" },
    });
    fireEvent.change(screen.getByLabelText("Eğitim Ücreti"), {
      target: { value: "12500" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createLicenseClassDefinitionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "A2",
          name: "A2 Motosiklet",
          category: "motorcycle",
          minimumAge: 16,
          theoryLessonHours: 34,
          courseFee: 12500,
          isActive: true,
          requiresTheoryExam: true,
          requiresPracticeExam: true,
        })
      );
    });
  });

  it("includes rowVersion when updating", async () => {
    renderWithProviders(<LicenseClassDefinitionsSettingsSection />);
    await screen.findByText("B Otomobil");

    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    fireEvent.change(screen.getByPlaceholderText("B Otomobil"), {
      target: { value: "B Otomobil Yeni" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateLicenseClassDefinitionMock).toHaveBeenCalledWith(
        "lc1",
        expect.objectContaining({
          code: "B",
          name: "B Otomobil Yeni",
          rowVersion: 1,
        })
      );
    });
  });

  it("shows server validation errors as a toast", async () => {
    updateLicenseClassDefinitionMock.mockRejectedValueOnce(
      new ApiError(
        400,
        "Bad Request",
        { RowVersion: ["Row version is required."] },
        {
          RowVersion: [{ code: "licenseClassDefinition.validation.rowVersionRequired" }],
        }
      )
    );

    renderWithProviders(<LicenseClassDefinitionsSettingsSection />);
    await screen.findByText("B Otomobil");

    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByText("Kayıt sürümü zorunlu")).toBeInTheDocument();
  });

  it("deletes a license class with inline confirmation", async () => {
    renderWithProviders(<LicenseClassDefinitionsSettingsSection />);
    await screen.findByText("B Otomobil");

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    expect(deleteLicenseClassDefinitionMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^Sil$/ }));

    await waitFor(() => {
      expect(deleteLicenseClassDefinitionMock).toHaveBeenCalledWith("lc1");
    });
  });
});
