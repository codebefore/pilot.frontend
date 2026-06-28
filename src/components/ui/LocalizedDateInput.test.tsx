import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("formats day values as dd.mm.yyyy regardless of language", () => {
    renderWithProviders(
      <LocalizedDateInput lang="en-US" onChange={() => {}} value="2026-06-27" />
    );

    expect(screen.getByRole("textbox")).toHaveValue("27.06.2026");
  });

  it("uses dd.mm.yyyy as the day placeholder", () => {
    renderWithProviders(
      <LocalizedDateInput lang="en-US" onChange={() => {}} value="" />
    );

    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "gg.aa.yyyy");
  });

  it("parses typed dd.mm.yyyy day values to ISO values", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <LocalizedDateInput lang="en-US" onChange={onChange} value="" />
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "27.06.2026" } });

    expect(onChange).toHaveBeenCalledWith("2026-06-27");
  });

  it("parses compact ddmmyyyy day values to ISO values", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <LocalizedDateInput onChange={onChange} value="" />
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "07082026" } });

    expect(onChange).toHaveBeenCalledWith("2026-08-07");
    expect(screen.getByRole("textbox")).toHaveValue("07.08.2026");
  });

  it("rejects invalid compact ddmmyyyy day values", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <LocalizedDateInput onChange={onChange} value="" />
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "31022026" } });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("31022026");
  });
});
