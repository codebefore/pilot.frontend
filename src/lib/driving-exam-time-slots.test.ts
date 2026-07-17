import { describe, expect, it } from "vitest";

import { drivingExamTimeSlotLabel } from "./driving-exam-time-slots";

describe("drivingExamTimeSlotLabel", () => {
  it("returns the interval for a defined driving exam time", () => {
    expect(drivingExamTimeSlotLabel("10:00")).toBe("10:00 - 10:40");
  });

  it("returns a dash for a time outside the defined intervals", () => {
    expect(drivingExamTimeSlotLabel("09:00")).toBe("—");
  });
});
