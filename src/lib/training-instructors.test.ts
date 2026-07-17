import { describe, expect, it } from "vitest";

import type { InstructorResponse } from "./types";
import { instructorSupportsLicenseClass } from "./training-instructors";

function instructor(licenseClassCodes: InstructorResponse["licenseClassCodes"]): InstructorResponse {
  return {
    id: "instructor-1",
    firstName: "Ayşe",
    lastName: "Yılmaz",
    branches: ["practice"],
    licenseClassCodes,
  } as InstructorResponse;
}

describe("instructorSupportsLicenseClass", () => {
  it("matches an instructor against the candidate license class", () => {
    expect(instructorSupportsLicenseClass(instructor(["A2", "B"]), "b")).toBe(true);
    expect(instructorSupportsLicenseClass(instructor(["A2"]), "B")).toBe(false);
  });
});
