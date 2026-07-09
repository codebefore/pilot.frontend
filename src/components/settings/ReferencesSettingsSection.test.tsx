import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { ReferencesSettingsSection } from "./ReferencesSettingsSection";

const getCandidateReferencesMock = vi.fn();
const createCandidateReferenceMock = vi.fn();
const updateCandidateReferenceMock = vi.fn();
const deleteCandidateReferenceMock = vi.fn();
const getVehiclesMock = vi.fn();

vi.mock("../../lib/candidate-references-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/candidate-references-api")>(
    "../../lib/candidate-references-api"
  );

  return {
    ...actual,
    getCandidateReferences: (...args: Parameters<typeof actual.getCandidateReferences>) =>
      getCandidateReferencesMock(...args),
    createCandidateReference: (...args: Parameters<typeof actual.createCandidateReference>) =>
      createCandidateReferenceMock(...args),
    updateCandidateReference: (...args: Parameters<typeof actual.updateCandidateReference>) =>
      updateCandidateReferenceMock(...args),
    deleteCandidateReference: (...args: Parameters<typeof actual.deleteCandidateReference>) =>
      deleteCandidateReferenceMock(...args),
  };
});

vi.mock("../../lib/vehicles-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/vehicles-api")>(
    "../../lib/vehicles-api"
  );

  return {
    ...actual,
    getVehicles: (...args: Parameters<typeof actual.getVehicles>) => getVehiclesMock(...args),
  };
});

describe("ReferencesSettingsSection", () => {
  beforeEach(() => {
    getCandidateReferencesMock.mockReset();
    createCandidateReferenceMock.mockReset();
    updateCandidateReferenceMock.mockReset();
    deleteCandidateReferenceMock.mockReset();
    getVehiclesMock.mockReset();

    getCandidateReferencesMock.mockResolvedValue([
      {
        id: "ref-1",
        name: "Tavsiye",
        displayOrder: 100,
        isActive: true,
        createdAtUtc: "2026-01-01T00:00:00Z",
        updatedAtUtc: "2026-01-01T00:00:00Z",
        rowVersion: 1,
      },
    ]);
    getVehiclesMock.mockResolvedValue({
      items: [
        {
          id: "vehicle-1",
          plateNumber: "34 ABC 123",
          brand: "Renault",
          model: "Clio",
          status: "idle",
          isActive: true,
          isSimulator: false,
          transmissionType: "manual",
          vehicleType: "automobile",
          licenseClasses: ["B"],
          ownershipType: "owned",
          fuelType: "gasoline",
          modelYear: null,
          color: null,
          odometerValue: null,
          odometerUnit: "km",
          registrationDate: null,
          serviceStartDate: null,
          latestInsuranceEndDate: null,
          latestInspectionEndDate: null,
          latestCascoEndDate: null,
          accidentNotes: null,
          otherDetails: null,
          notes: null,
          createdAtUtc: "2026-01-01T00:00:00Z",
          updatedAtUtc: "2026-01-01T00:00:00Z",
          rowVersion: 1,
        },
      ],
      summary: { activeCount: 1, inUseCount: 0, maintenanceCount: 0, idleCount: 1 },
      page: 1,
      pageSize: 1000,
      totalCount: 1,
      totalPages: 1,
    });
  });

  it("disables reference mutations for candidates view-only users", async () => {
    renderWithProviders(<ReferencesSettingsSection />, {
      auth: {
        user: {
          id: "candidate-viewer",
          phone: "5073737262",
          name: "Candidate Viewer",
          roleName: "Aday İzleme",
          isSuperAdmin: false,
        },
        permissions: { candidates: "view" },
      },
    });

    expect(await screen.findByText("Tavsiye")).toBeInTheDocument();

    const newButton = screen.getByRole("button", { name: "Yeni Referans" });
    expect(newButton).toBeDisabled();
    fireEvent.click(newButton);
    const disabledActions = screen.getAllByTitle("Yetkiniz yok.");
    fireEvent.click(disabledActions[1]);
    fireEvent.click(disabledActions[2]);

    expect(screen.queryByPlaceholderText("Referans adı")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vazgeç" })).not.toBeInTheDocument();
    expect(disabledActions).toHaveLength(3);
    expect(createCandidateReferenceMock).not.toHaveBeenCalled();
    expect(updateCandidateReferenceMock).not.toHaveBeenCalled();
    expect(deleteCandidateReferenceMock).not.toHaveBeenCalled();
  });

  it("loads and creates routes with the route kind", async () => {
    createCandidateReferenceMock.mockResolvedValue({
      id: "route-1",
      kind: "route",
      name: "Sahil",
      displayOrder: 200,
      isActive: true,
      createdAtUtc: "2026-01-01T00:00:00Z",
      updatedAtUtc: "2026-01-01T00:00:00Z",
      rowVersion: 1,
    });

    renderWithProviders(<ReferencesSettingsSection variant="routes" />);

    expect(await screen.findByText("Tavsiye")).toBeInTheDocument();
    expect(getCandidateReferencesMock).toHaveBeenCalledWith(
      { includeInactive: true, kind: "route" },
      expect.any(AbortSignal)
    );

    fireEvent.click(screen.getByRole("button", { name: "Yeni Güzergah" }));
    fireEvent.change(screen.getByPlaceholderText("Güzergah adı"), {
      target: { value: "Sahil" },
    });
    fireEvent.click(await screen.findByLabelText("34 ABC 123 · Renault Clio"));
    fireEvent.click(screen.getByRole("button", { name: "Ekle" }));

    expect(await screen.findByText("Güzergah eklendi")).toBeInTheDocument();
    expect(createCandidateReferenceMock).toHaveBeenCalledWith({
      kind: "route",
      name: "Sahil",
      vehicleIds: ["vehicle-1"],
      displayOrder: 200,
      isActive: true,
    });
  });

  it("updates route vehicle toggles", async () => {
    getCandidateReferencesMock.mockResolvedValue([
      {
        id: "route-1",
        kind: "route",
        name: "Sahil",
        vehicleIds: [],
        displayOrder: 200,
        isActive: true,
        createdAtUtc: "2026-01-01T00:00:00Z",
        updatedAtUtc: "2026-01-01T00:00:00Z",
        rowVersion: 7,
      },
    ]);
    updateCandidateReferenceMock.mockResolvedValue({
      id: "route-1",
      kind: "route",
      name: "Sahil",
      vehicleIds: ["vehicle-1"],
      displayOrder: 200,
      isActive: true,
      createdAtUtc: "2026-01-01T00:00:00Z",
      updatedAtUtc: "2026-01-01T00:00:00Z",
      rowVersion: 8,
    });

    renderWithProviders(<ReferencesSettingsSection variant="routes" />);

    expect(await screen.findByText("Sahil")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Düzenle"));
    fireEvent.click(await screen.findByLabelText("34 ABC 123 · Renault Clio"));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByText("Güzergah güncellendi")).toBeInTheDocument();
    expect(updateCandidateReferenceMock).toHaveBeenCalledWith("route-1", {
      kind: "route",
      name: "Sahil",
      vehicleIds: ["vehicle-1"],
      displayOrder: 200,
      isActive: true,
      rowVersion: 7,
    });
  });
});
