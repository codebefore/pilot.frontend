import { describe, expect, it } from "vitest";

import type { VehicleResponse } from "./types";
import { vehicleSupportsLicenseClass } from "./training-vehicles";

function vehicle(overrides: Partial<VehicleResponse> = {}): VehicleResponse {
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
    createdAtUtc: "2026-07-17T00:00:00.000Z",
    updatedAtUtc: "2026-07-17T00:00:00.000Z",
    rowVersion: 1,
    ...overrides,
  };
}

describe("vehicleSupportsLicenseClass", () => {
  it("matches a vehicle against the candidate license class", () => {
    expect(vehicleSupportsLicenseClass(vehicle({ licenseClasses: ["A2", "B"] }), "b")).toBe(true);
    expect(vehicleSupportsLicenseClass(vehicle({ licenseClasses: ["A2"] }), "B")).toBe(false);
  });

  it("keeps simulator vehicles available for every license class", () => {
    expect(
      vehicleSupportsLicenseClass(
        vehicle({ isSimulator: true, licenseClasses: [] }),
        "D"
      )
    ).toBe(true);
  });
});
