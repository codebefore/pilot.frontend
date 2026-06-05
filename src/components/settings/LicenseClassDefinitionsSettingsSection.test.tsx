import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/http";
import { renderWithProviders } from "../../test/render-with-providers";
import { LicenseClassDefinitionsSettingsSection } from "./LicenseClassDefinitionsSettingsSection";

const getLicenseClassDefinitionsMock = vi.fn();
const createLicenseClassDefinitionMock = vi.fn();
const updateLicenseClassDefinitionMock = vi.fn();
const updateLicenseClassDefinitionActivityMock = vi.fn();
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
    updateLicenseClassDefinitionActivity: (
      ...args: Parameters<typeof actual.updateLicenseClassDefinitionActivity>
    ) => updateLicenseClassDefinitionActivityMock(...args),
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
  hasExistingLicense: false,
  existingLicenseType: null,
  existingLicensePre2016: false,
  requiresTheoryExam: true,
  requiresPracticeExam: true,
  theoryLessonHours: 34,
  simulatorLessonHours: 2,
  directPracticeLessonHours: 14,
  displayOrder: 20,
  isActive: true,
  notes: null,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
  rowVersion: 1,
};

function renderSection(auth?: NonNullable<Parameters<typeof renderWithProviders>[1]>["auth"]) {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/settings/definitions/license-classes"]}>
      <LicenseClassDefinitionsSettingsSection />
    </MemoryRouter>,
    { auth }
  );
}

describe("LicenseClassDefinitionsSettingsSection", () => {
  beforeEach(() => {
    localStorage.clear();
    getLicenseClassDefinitionsMock.mockReset();
    createLicenseClassDefinitionMock.mockReset();
    updateLicenseClassDefinitionMock.mockReset();
    updateLicenseClassDefinitionActivityMock.mockReset();
    deleteLicenseClassDefinitionMock.mockReset();

    getLicenseClassDefinitionsMock.mockResolvedValue({
      items: [sampleLicenseClass],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
      summary: {
        activeCount: 1,
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
    updateLicenseClassDefinitionActivityMock.mockResolvedValue({
      ...sampleLicenseClass,
      isActive: false,
      rowVersion: 2,
    });
    deleteLicenseClassDefinitionMock.mockResolvedValue(undefined);
  });

  it("loads all license classes on mount", async () => {
    renderSection();

    await waitFor(() => {
      expect(getLicenseClassDefinitionsMock).toHaveBeenCalledWith(
        {
          activity: "all",
          code: undefined,
          page: 1,
          pageSize: 10,
          search: undefined,
          sortBy: "displayOrder",
          sortDir: "asc",
        }
      );
    });

    expect(await screen.findByText("B")).toBeInTheDocument();
    expect(screen.getByText("Otomobil")).toBeInTheDocument();
    expect(screen.getByText("Mevcut Ehliyet")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("shows existing license type when required", async () => {
    getLicenseClassDefinitionsMock.mockResolvedValue({
      items: [
        {
          ...sampleLicenseClass,
          id: "lc2",
          code: "D",
          hasExistingLicense: true,
          existingLicenseType: "b",
          existingLicensePre2016: true,
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
      summary: {
        activeCount: 1,
      },
    });

    renderSection();

    expect(await screen.findByText("B (2016 öncesi)")).toBeInTheDocument();
  });

  it("applies filters and re-fetches", async () => {
    renderSection();
    await waitFor(() => expect(getLicenseClassDefinitionsMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Durum filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Pasif" }));

    fireEvent.click(screen.getByRole("button", { name: "Ehliyet tipi filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Motosiklet" }));

    await waitFor(() => {
      expect(getLicenseClassDefinitionsMock).toHaveBeenLastCalledWith(
        {
          activity: "inactive",
          category: "motorcycle",
          code: undefined,
          page: 1,
          pageSize: 10,
          search: undefined,
          sortBy: "displayOrder",
          sortDir: "asc",
        }
      );
    });
  });

  it("filters by code from the code column", async () => {
    renderSection();
    await waitFor(() => expect(getLicenseClassDefinitionsMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Kod filtresi" }));
    fireEvent.change(screen.getByPlaceholderText("Kod ara"), {
      target: { value: " b " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ara" }));

    await waitFor(() => {
      expect(getLicenseClassDefinitionsMock).toHaveBeenLastCalledWith(
        {
          activity: "all",
          code: "b",
          page: 1,
          pageSize: 10,
          search: undefined,
          sortBy: "displayOrder",
          sortDir: "asc",
        }
      );
    });
  });

  it("submits canonical payload when creating", async () => {
    renderSection();
    await waitFor(() => expect(getLicenseClassDefinitionsMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Yeni Kural/i }));

    fireEvent.change(screen.getByPlaceholderText("B"), {
      target: { value: " a2 " },
    });
    expect(screen.getByPlaceholderText("B")).toHaveValue(" A2 ");
    fireEvent.change(screen.getByDisplayValue("Otomobil"), {
      target: { value: "motorcycle" },
    });
    fireEvent.change(screen.getByPlaceholderText("18"), {
      target: { value: "16" },
    });
    fireEvent.change(screen.getByLabelText("Teorik Ders Saati"), {
      target: { value: "34" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createLicenseClassDefinitionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "A2",
          category: "motorcycle",
          minimumAge: 16,
          theoryLessonHours: 34,
          isActive: true,
          requiresTheoryExam: true,
          requiresPracticeExam: true,
        })
      );
    });
  });

  it("includes rowVersion when updating", async () => {
    renderSection();
    await screen.findByText("B");

    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateLicenseClassDefinitionMock).toHaveBeenCalledWith(
        "lc1",
        expect.objectContaining({
          code: "B",
          rowVersion: 1,
        })
      );
    });
  });

  it("toggles active status from the status column", async () => {
    updateLicenseClassDefinitionActivityMock.mockResolvedValueOnce({
      ...sampleLicenseClass,
      isActive: false,
      rowVersion: 2,
    });

    renderSection();
    await screen.findByText("B");

    fireEvent.click(screen.getByRole("checkbox", { name: "B durumunu pasife al" }));

    await waitFor(() => {
      expect(updateLicenseClassDefinitionActivityMock).toHaveBeenCalledWith(
        "lc1",
        {
          isActive: false,
          rowVersion: 1,
        }
      );
    });
    expect(updateLicenseClassDefinitionMock).not.toHaveBeenCalled();
  });

  it("disables global catalog mutations but allows activity toggles for settings full users", async () => {
    renderSection({
      user: {
        id: "settings-manager",
        phone: "5000000001",
        name: "Settings Manager",
        roleName: "Ayarlar",
        isSuperAdmin: false,
      },
      permissions: { settings: "full", training: "full" },
    });
    await screen.findByText("B");

    expect(screen.queryByRole("button", { name: /Yeni Kural/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Düzenle" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "B durumunu pasife al" }));
    await waitFor(() => {
      expect(updateLicenseClassDefinitionActivityMock).toHaveBeenCalledWith(
        "lc1",
        {
          isActive: false,
          rowVersion: 1,
        }
      );
    });
    expect(screen.queryByRole("button", { name: "Sil" })).not.toBeInTheDocument();
  });

  it("disables activity toggles for settings view users", async () => {
    renderSection({
      user: {
        id: "settings-viewer",
        phone: "5000000002",
        name: "Settings Viewer",
        roleName: "Ayarlar Görüntüleme",
        isSuperAdmin: false,
      },
      permissions: { settings: "view" },
    });
    await screen.findByText("B");

    expect(screen.queryByRole("button", { name: /Yeni Kural/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Düzenle" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "B durumunu pasife al" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Sil" })).not.toBeInTheDocument();
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

    renderSection();
    await screen.findByText("B");

    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByText("Kayıt sürümü zorunlu")).toBeInTheDocument();
  });

  it("deletes a license class with inline confirmation", async () => {
    renderSection();
    await screen.findByText("B");

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    expect(deleteLicenseClassDefinitionMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^Sil$/ }));

    await waitFor(() => {
      expect(deleteLicenseClassDefinitionMock).toHaveBeenCalledWith("lc1");
    });
  });
});
