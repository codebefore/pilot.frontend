import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { VehicleDetailPage } from "./VehicleDetailPage";

const getVehicleMock = vi.fn();
const listVehicleDocumentsMock = vi.fn();
const createVehicleDocumentMock = vi.fn();
const updateVehicleDocumentMock = vi.fn();
const deleteVehicleDocumentMock = vi.fn();

vi.mock("../lib/vehicles-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/vehicles-api")>(
    "../lib/vehicles-api"
  );

  return {
    ...actual,
    getVehicle: (...args: Parameters<typeof actual.getVehicle>) => getVehicleMock(...args),
  };
});

vi.mock("../lib/vehicle-documents-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/vehicle-documents-api")>(
    "../lib/vehicle-documents-api"
  );

  return {
    ...actual,
    listVehicleDocuments: (...args: Parameters<typeof actual.listVehicleDocuments>) =>
      listVehicleDocumentsMock(...args),
    createVehicleDocument: (...args: Parameters<typeof actual.createVehicleDocument>) =>
      createVehicleDocumentMock(...args),
    updateVehicleDocument: (...args: Parameters<typeof actual.updateVehicleDocument>) =>
      updateVehicleDocumentMock(...args),
    deleteVehicleDocument: (...args: Parameters<typeof actual.deleteVehicleDocument>) =>
      deleteVehicleDocumentMock(...args),
  };
});

const vehicle = {
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
  licenseClasses: ["B"] as const,
  ownershipType: "owned" as const,
  fuelType: "diesel" as const,
  odometerValue: 12000,
  odometerUnit: "km" as const,
  registrationDate: null,
  serviceStartDate: null,
  latestInsuranceEndDate: "2026-05-10",
  latestInspectionEndDate: null,
  latestCascoEndDate: null,
  accidentNotes: null,
  otherDetails: null,
  notes: null,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
  rowVersion: 1,
};

const document = {
  id: "doc-1",
  vehicleId: "v1",
  documentType: "insurance" as const,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  notes: "Poliçe",
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
  rowVersion: 1,
};

function renderPage(auth?: NonNullable<Parameters<typeof renderWithProviders>[1]>["auth"]) {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/settings/definitions/vehicles/v1"]}>
      <Routes>
        <Route
          element={<VehicleDetailPage />}
          path="/settings/definitions/vehicles/:vehicleId"
        />
      </Routes>
    </MemoryRouter>,
    { auth }
  );
}

describe("VehicleDetailPage permissions", () => {
  beforeEach(() => {
    getVehicleMock.mockReset();
    listVehicleDocumentsMock.mockReset();
    createVehicleDocumentMock.mockReset();
    updateVehicleDocumentMock.mockReset();
    deleteVehicleDocumentMock.mockReset();

    getVehicleMock.mockResolvedValue(vehicle);
    listVehicleDocumentsMock.mockResolvedValue([document]);
  });

  it("disables document mutations for documents view-only users", async () => {
    renderPage({
      user: {
        id: "readonly-user",
        phone: "5000000001",
        name: "Read Only",
        roleName: "Evrak",
        isSuperAdmin: false,
      },
      permissions: { training: "view", documents: "view" },
    });

    await waitFor(() => expect(getVehicleMock).toHaveBeenCalledWith("v1", expect.any(AbortSignal)));
    expect(await screen.findByText("34 ABC 123")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Yeni Sigorta Kaydı" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Yeni Muayene Kaydı" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Yeni Kasko Kaydı" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Düzenle" })).toBeDisabled();
    const deleteButton = screen.getByRole("button", { name: "Sil" });
    expect(deleteButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Yeni Sigorta Kaydı" }));
    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    fireEvent.click(deleteButton);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(createVehicleDocumentMock).not.toHaveBeenCalled();
    expect(updateVehicleDocumentMock).not.toHaveBeenCalled();
    expect(deleteVehicleDocumentMock).not.toHaveBeenCalled();
  });
});
