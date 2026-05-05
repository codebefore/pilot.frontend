import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/http";
import { renderWithProviders } from "../../test/render-with-providers";
import { VehiclesSettingsSection } from "./VehiclesSettingsSection";

const getVehiclesMock = vi.fn();
const createVehicleMock = vi.fn();
const updateVehicleMock = vi.fn();
const deleteVehicleMock = vi.fn();
const getLicenseClassDefinitionsMock = vi.fn();

vi.mock("../../lib/vehicles-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/vehicles-api")>(
    "../../lib/vehicles-api"
  );

  return {
    ...actual,
    getVehicles: (...args: Parameters<typeof actual.getVehicles>) => getVehiclesMock(...args),
    createVehicle: (...args: Parameters<typeof actual.createVehicle>) =>
      createVehicleMock(...args),
    updateVehicle: (...args: Parameters<typeof actual.updateVehicle>) =>
      updateVehicleMock(...args),
    deleteVehicle: (...args: Parameters<typeof actual.deleteVehicle>) =>
      deleteVehicleMock(...args),
  };
});

vi.mock("../../lib/license-class-definitions-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/license-class-definitions-api")>(
    "../../lib/license-class-definitions-api"
  );

  return {
    ...actual,
    getLicenseClassDefinitions: (
      ...args: Parameters<typeof actual.getLicenseClassDefinitions>
    ) => getLicenseClassDefinitionsMock(...args),
  };
});

const sampleVehicle = {
  id: "v1",
  plateNumber: "34 ABC 123",
  brand: "Fiat",
  model: "Egea",
  modelYear: 2024,
  color: "Beyaz",
  status: "idle" as const,
  isActive: true,
  transmissionType: "manual" as const,
  vehicleType: "automobile" as const,
  licenseClass: "B" as const,
  ownershipType: "owned" as const,
  fuelType: "diesel" as const,
  odometerValue: 12000,
  odometerUnit: "km" as const,
  insuranceStartDate: null,
  insuranceEndDate: "2026-05-10",
  inspectionStartDate: null,
  inspectionEndDate: "2026-06-15",
  cascoStartDate: null,
  cascoEndDate: "2026-07-20",
  accidentNotes: null,
  otherDetails: null,
  notes: null,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
  rowVersion: 1,
};

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/settings/definitions/vehicles"]}>
      <VehiclesSettingsSection />
    </MemoryRouter>
  );
}

describe("VehiclesSettingsSection", () => {
  beforeEach(() => {
    localStorage.clear();
    getVehiclesMock.mockReset();
    createVehicleMock.mockReset();
    updateVehicleMock.mockReset();
    deleteVehicleMock.mockReset();
    getLicenseClassDefinitionsMock.mockReset();

    getVehiclesMock.mockResolvedValue({
      items: [sampleVehicle],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
      summary: {
        activeCount: 1,
        inUseCount: 0,
        maintenanceCount: 0,
        idleCount: 1,
      },
    });
    createVehicleMock.mockResolvedValue({
      ...sampleVehicle,
      id: "v2",
      plateNumber: "35 XYZ 987",
      brand: "HONDA",
      model: "CIVIC",
      vehicleType: "motorcycle",
      licenseClass: "A2",
      transmissionType: "automatic",
    });
    updateVehicleMock.mockResolvedValue({
      ...sampleVehicle,
      brand: "Tofas",
    });
    deleteVehicleMock.mockResolvedValue(undefined);
    getLicenseClassDefinitionsMock.mockResolvedValue({
      items: [
        {
          id: "license-b",
          code: "B",
          name: "B",
          category: "automobile",
          minimumAge: 18,
          hasExistingLicense: false,
          existingLicenseType: null,
          existingLicensePre2016: false,
          requiresTheoryExam: true,
          requiresPracticeExam: true,
          theoryLessonHours: 34,
          simulatorLessonHours: 0,
          directPracticeLessonHours: 14,
          displayOrder: 10,
          isActive: true,
          notes: null,
          createdAtUtc: "2026-01-01T00:00:00Z",
          updatedAtUtc: "2026-01-01T00:00:00Z",
          rowVersion: 1,
        },
        {
          id: "license-a2",
          code: "A2",
          name: "A2",
          category: "motorcycle",
          minimumAge: 18,
          hasExistingLicense: false,
          existingLicenseType: null,
          existingLicensePre2016: false,
          requiresTheoryExam: true,
          requiresPracticeExam: true,
          theoryLessonHours: 34,
          simulatorLessonHours: 0,
          directPracticeLessonHours: 14,
          displayOrder: 20,
          isActive: true,
          notes: null,
          createdAtUtc: "2026-01-01T00:00:00Z",
          updatedAtUtc: "2026-01-01T00:00:00Z",
          rowVersion: 1,
        },
      ],
      page: 1,
      pageSize: 1000,
      totalCount: 2,
      totalPages: 1,
      summary: {
        activeCount: 2,
        inactiveCount: 0,
      },
    });
  });

  it("loads only active vehicles on mount", async () => {
    renderSection();

    await waitFor(() => {
      expect(getVehiclesMock).toHaveBeenCalledWith(
        { activity: "active", page: 1, pageSize: 10, search: undefined },
        expect.any(AbortSignal)
      );
    });

    expect(await screen.findByText("34 ABC 123")).toBeInTheDocument();
    expect(screen.queryByText("Fiat Egea · 2024")).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Sigorta Bit. Trh. (Kalan Gün)" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Muayene Bit. Trh. (Kalan Gün)" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Kasko Bit. Trh. (Kalan Gün)" })).toBeInTheDocument();
    expect(screen.getByText(/10\.05\.2026/)).toBeInTheDocument();
  });

  it("applies filters and re-fetches", async () => {
    renderSection();
    await waitFor(() => expect(getVehiclesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Genel Durum filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Pasif" }));

    fireEvent.click(screen.getByRole("button", { name: "Araç Durumu filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Bakımda" }));

    fireEvent.click(screen.getByRole("button", { name: "Belge filtresi" }));
    fireEvent.click(await screen.findByRole("button", { name: /^A2 -/ }));

    await waitFor(() => {
      expect(getVehiclesMock).toHaveBeenLastCalledWith(
        {
          activity: "inactive",
          status: "maintenance",
          licenseClass: "A2",
          page: 1,
          pageSize: 10,
          search: undefined,
        },
        expect.any(AbortSignal)
      );
    });
  });

  it("navigates pages and re-fetches the target page", async () => {
    getVehiclesMock
      .mockResolvedValueOnce({
        items: [sampleVehicle],
        page: 1,
        pageSize: 10,
        totalCount: 11,
        totalPages: 2,
        summary: {
          activeCount: 10,
          inUseCount: 1,
          maintenanceCount: 0,
          idleCount: 9,
        },
      })
      .mockResolvedValueOnce({
        items: [{ ...sampleVehicle, id: "v2", plateNumber: "35 XYZ 987" }],
        page: 2,
        pageSize: 10,
        totalCount: 11,
        totalPages: 2,
        summary: {
          activeCount: 10,
          inUseCount: 1,
          maintenanceCount: 0,
          idleCount: 9,
        },
      });

    renderSection();
    await screen.findByText("34 ABC 123");

    fireEvent.click(screen.getByRole("button", { name: /Sonraki/ }));

    await waitFor(() => {
      expect(getVehiclesMock).toHaveBeenLastCalledWith(
        { activity: "active", page: 2, pageSize: 10, search: undefined },
        expect.any(AbortSignal)
      );
    });

    expect(await screen.findByText("35 XYZ 987")).toBeInTheDocument();
  });

  it("cycles Plaka sorting and resets pagination to page 1", async () => {
    getVehiclesMock.mockResolvedValue({
      items: [sampleVehicle],
      page: 1,
      pageSize: 10,
      totalCount: 11,
      totalPages: 2,
      summary: {
        activeCount: 10,
        inUseCount: 1,
        maintenanceCount: 0,
        idleCount: 9,
      },
    });

    renderSection();
    await screen.findByText("34 ABC 123");

    fireEvent.click(screen.getByRole("button", { name: /Sonraki/ }));

    await waitFor(() => {
      expect(getVehiclesMock).toHaveBeenLastCalledWith(
        { activity: "active", page: 2, pageSize: 10, search: undefined },
        expect.any(AbortSignal)
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /^Plaka/ }));

    await waitFor(() => {
      expect(getVehiclesMock).toHaveBeenLastCalledWith(
        {
          activity: "active",
          page: 1,
          pageSize: 10,
          search: undefined,
          sortBy: "plateNumber",
          sortDir: "asc",
        },
        expect.any(AbortSignal)
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /^Plaka/ }));

    await waitFor(() => {
      expect(getVehiclesMock).toHaveBeenLastCalledWith(
        {
          activity: "active",
          page: 1,
          pageSize: 10,
          search: undefined,
          sortBy: "plateNumber",
          sortDir: "desc",
        },
        expect.any(AbortSignal)
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /^Plaka/ }));

    await waitFor(() => {
      expect(getVehiclesMock).toHaveBeenLastCalledWith(
        { activity: "active", page: 1, pageSize: 10, search: undefined },
        expect.any(AbortSignal)
      );
    });
  });

  it("renders fixed vehicle columns without column picker", async () => {
    renderSection();
    await screen.findByText("34 ABC 123");

    expect(screen.queryByRole("button", { name: "Sütunlar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vites" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marka / Model" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plaka" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Belge" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Araç Durumu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Genel Durum" })).toBeInTheDocument();
  });

  it("deletes a vehicle with inline confirmation", async () => {
    renderSection();
    await screen.findByText("34 ABC 123");

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));

    expect(deleteVehicleMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^Sil$/ }));

    await waitFor(() => {
      expect(deleteVehicleMock).toHaveBeenCalledWith("v1");
    });

    await waitFor(() => {
      expect(getVehiclesMock).toHaveBeenCalledTimes(2);
    });
  });

  it("shows unmapped server validation errors as a toast", async () => {
    updateVehicleMock.mockRejectedValueOnce(
      new ApiError(
        400,
        "Bad Request",
        { RowVersion: ["Row version is required."] },
        {
          RowVersion: [
            { code: "vehicle.validation.rowVersionRequired" },
          ],
        }
      )
    );

    renderSection();
    await screen.findByText("34 ABC 123");

    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByText("Kayıt sürümü zorunlu")).toBeInTheDocument();
  });

  it("submits canonical payload when creating", async () => {
    renderSection();
    await waitFor(() => expect(getVehiclesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Yeni Araç/i }));

    expect(screen.getByRole("button", { name: "Otomobil" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /B .*Otomobil/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Düz" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Boşta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Satın Alındı" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dizel" })).toBeInTheDocument();
    expect(screen.queryByText("Toplam KM / Saat")).not.toBeInTheDocument();
    expect(screen.queryByText("Ölçü Birimi")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("34 ABC 123"), {
      target: { value: " 35 xyz 987 " },
    });
    expect(screen.getByPlaceholderText("34 ABC 123")).toHaveValue(" 35 XYZ 987 ");
    fireEvent.change(screen.getByPlaceholderText("FIAT"), {
      target: { value: "Honda" },
    });
    expect(screen.getByPlaceholderText("FIAT")).toHaveValue("HONDA");
    fireEvent.change(screen.getByPlaceholderText("EGEA"), {
      target: { value: "Civic" },
    });
    expect(screen.getByPlaceholderText("EGEA")).toHaveValue("CIVIC");
    fireEvent.click(screen.getByRole("textbox", { name: "Model Yılı" }));
    fireEvent.click(screen.getByRole("button", { name: "2024" }));
    fireEvent.change(screen.getByDisplayValue("Otomobil"), {
      target: { value: "motorcycle" },
    });
    fireEvent.change(screen.getByDisplayValue(/B .*Otomobil/), {
      target: { value: "A2" },
    });
    fireEvent.change(screen.getByDisplayValue("Düz"), {
      target: { value: "automatic" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createVehicleMock).toHaveBeenCalledWith({
        plateNumber: "35 XYZ 987",
        brand: "HONDA",
        model: "CIVIC",
        modelYear: 2024,
        color: null,
        status: "idle",
        isActive: true,
        transmissionType: "automatic",
        vehicleType: "motorcycle",
        licenseClass: "A2",
        ownershipType: "owned",
        fuelType: "diesel",
        odometerValue: null,
        odometerUnit: "km",
        insuranceStartDate: null,
        insuranceEndDate: null,
        inspectionStartDate: null,
        inspectionEndDate: null,
        cascoStartDate: null,
        cascoEndDate: null,
        accidentNotes: null,
        otherDetails: null,
        notes: null,
      });
    });
  });
});
