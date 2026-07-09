import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TrainingCalendarEvent } from "../../lib/training-calendar";
import type { VehicleResponse } from "../../lib/types";
import { renderWithProviders } from "../../test/render-with-providers";
import { TrainingFilters } from "./TrainingFilters";

function vehicle(overrides: Partial<VehicleResponse>): VehicleResponse {
  return {
    id: "vehicle-1",
    plateNumber: "34 ABC 123",
    brand: "Renault",
    model: "Clio",
    modelYear: 2024,
    color: null,
    status: "idle",
    isActive: true,
    isSimulator: false,
    transmissionType: "manual",
    vehicleType: "automobile",
    licenseClasses: ["B"],
    ownershipType: "owned",
    fuelType: null,
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
    createdAtUtc: "2026-07-09T00:00:00.000Z",
    updatedAtUtc: "2026-07-09T00:00:00.000Z",
    rowVersion: 1,
    ...overrides,
  };
}

function practiceEvent(overrides: Partial<TrainingCalendarEvent>): TrainingCalendarEvent {
  return {
    id: "lesson-1",
    title: "16 DEL 456",
    start: new Date("2026-07-09T09:00:00.000Z"),
    end: new Date("2026-07-09T10:00:00.000Z"),
    kind: "uygulama",
    instructorId: "instructor-1",
    instructorName: "Test Eğitmen",
    termName: "-",
    groupName: "16 DEL 456",
    licenseClass: "B",
    candidateCount: 1,
    candidateId: "candidate-1",
    candidateName: "Test Aday",
    vehicleId: "deleted-vehicle",
    vehiclePlate: "16 DEL 456",
    ...overrides,
  };
}

describe("TrainingFilters", () => {
  it("does not show vehicles that only remain on old practice lesson events", () => {
    renderWithProviders(
      <TrainingFilters
        allInstructors={[]}
        allVehiclesCatalog={[vehicle({ id: "active-vehicle", plateNumber: "34 ABC 123" })]}
        events={[practiceEvent({})]}
        kind="uygulama"
        onSetGroupsVisibility={vi.fn()}
        onSetInstructorsVisibility={vi.fn()}
        onToggleGroup={vi.fn()}
        onToggleInstructor={vi.fn()}
        visibleGroups={new Set()}
        visibleInstructors={new Set()}
      />
    );

    expect(screen.getByText(/34 ABC 123/)).toBeInTheDocument();
    expect(screen.queryByText("16 DEL 456")).not.toBeInTheDocument();
  });

  it("shows SIM instead of all for simulator vehicles", () => {
    renderWithProviders(
      <TrainingFilters
        allInstructors={[]}
        allVehiclesCatalog={[
          vehicle({
            id: "simulator-1",
            plateNumber: "6111072020001",
            isSimulator: true,
            licenseClasses: [],
          }),
        ]}
        events={[]}
        kind="uygulama"
        onSetGroupsVisibility={vi.fn()}
        onSetInstructorsVisibility={vi.fn()}
        onToggleGroup={vi.fn()}
        onToggleInstructor={vi.fn()}
        visibleGroups={new Set()}
        visibleInstructors={new Set()}
      />
    );

    expect(screen.getByText(/6111072020001/)).toBeInTheDocument();
    expect(screen.getByText("SIM")).toBeInTheDocument();
    expect(screen.queryByText("Tümü")).not.toBeInTheDocument();
  });
});
