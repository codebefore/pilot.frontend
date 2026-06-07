import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { LocalizedDateInput } from "./LocalizedDateInput";

describe("LocalizedDateInput", () => {
  beforeEach(() => {
    localStorage.removeItem("pilot.lang");
  });

  it("uses the active app language when lang prop is not provided", () => {
    renderWithProviders(
      <LocalizedDateInput mode="month" onChange={() => {}} value="2026-06-01" />
    );

    expect(screen.getByRole("textbox")).toHaveValue("Haziran 2026");
  });

  it("uses an explicit lang prop when provided", () => {
    renderWithProviders(
      <LocalizedDateInput lang="en-US" mode="month" onChange={() => {}} value="2026-06-01" />
    );

    expect(screen.getByRole("textbox")).toHaveValue("June 2026");
  });

  it("accepts short Turkish lang values from legacy callers", () => {
    renderWithProviders(
      <LocalizedDateInput lang="tr" mode="month" onChange={() => {}} value="2026-06-01" />
    );

    expect(screen.getByRole("textbox")).toHaveValue("Haziran 2026");
  });
});
