import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { VehiclesSettingsSection } from "./VehiclesSettingsSection";

const getVehiclesMock = vi.fn();
const createVehicleMock = vi.fn();
const updateVehicleMock = vi.fn();
const deleteVehicleMock = vi.fn();

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
  notes: null,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
};

describe("VehiclesSettingsSection", () => {
  beforeEach(() => {
    localStorage.clear();
    getVehiclesMock.mockReset();
    createVehicleMock.mockReset();
    updateVehicleMock.mockReset();
    deleteVehicleMock.mockReset();

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
  });

  it("loads only active vehicles on mount", async () => {
    renderWithProviders(<VehiclesSettingsSection />);

    await waitFor(() => {
      expect(getVehiclesMock).toHaveBeenCalledWith(
        { activity: "active", page: 1, pageSize: 10, search: undefined },
        expect.any(AbortSignal)
      );
    });

    expect(await screen.findByText("34 ABC 123")).toBeInTheDocument();
    expect(screen.getByText("Fiat Egea · 2024")).toBeInTheDocument();
  });

  it("applies filters and re-fetches", async () => {
    renderWithProviders(<VehiclesSettingsSection />);
    await waitFor(() => expect(getVehiclesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Genel Durum filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Pasif" }));

    fireEvent.click(screen.getByRole("button", { name: "Araç Durumu filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Bakımda" }));

    fireEvent.click(screen.getByRole("button", { name: "Belge filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "A2" }));

    fireEvent.click(screen.getByRole("button", { name: "Vites filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Otomatik" }));

    await waitFor(() => {
      expect(getVehiclesMock).toHaveBeenLastCalledWith(
        {
          activity: "inactive",
          status: "maintenance",
          licenseClass: "A2",
          transmissionType: "automatic",
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

    renderWithProviders(<VehiclesSettingsSection />);
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

    renderWithProviders(<VehiclesSettingsSection />);
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

  it("lets the user hide a column and keeps the choice", async () => {
    const firstRender = renderWithProviders(<VehiclesSettingsSection />);
    await screen.findByRole("button", { name: "Vites" });

    fireEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Vites" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Vites" })).not.toBeInTheDocument();
    });
    expect(localStorage.getItem("settings.vehicles.columns.v1")).toBe(
      JSON.stringify([
        "plateNumber",
        "brandModel",
        "vehicleType",
        "licenseClass",
        "status",
        "isActive",
      ])
    );

    firstRender.unmount();

    renderWithProviders(<VehiclesSettingsSection />);
    await waitFor(() => expect(getVehiclesMock).toHaveBeenCalled());

    expect(screen.queryByRole("button", { name: "Vites" })).not.toBeInTheDocument();
  });

  it("deletes a vehicle with inline confirmation", async () => {
    renderWithProviders(<VehiclesSettingsSection />);
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

  it("submits canonical payload when creating", async () => {
    renderWithProviders(<VehiclesSettingsSection />);
    await waitFor(() => expect(getVehiclesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Yeni Araç/i }));

    expect(screen.getByRole("button", { name: "Otomobil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "B" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Düz" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Boşta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Satın Alındı" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dizel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kilometre" })).toBeInTheDocument();

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
    fireEvent.change(screen.getByDisplayValue("B"), {
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
        notes: null,
      });
    });
  });
});
