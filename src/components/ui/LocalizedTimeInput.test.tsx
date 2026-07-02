import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocalizedTimeInput } from "./LocalizedTimeInput";
import { renderWithProviders } from "../../test/render-with-providers";

describe("LocalizedTimeInput", () => {
  it("opens a styled time popover when focused", () => {
    renderWithProviders(
      <LocalizedTimeInput
        ariaLabel="Saat"
        onChange={vi.fn()}
        value="09:00"
      />
    );

    fireEvent.focus(screen.getByLabelText("Saat"));

    expect(screen.getByRole("dialog", { name: "Saat secimi" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "09:00" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("selects a time option and closes the popover", () => {
    const onChange = vi.fn();

    renderWithProviders(
      <LocalizedTimeInput
        ariaLabel="Saat"
        onChange={onChange}
        value="09:00"
      />
    );

    fireEvent.click(screen.getByLabelText("Saat"));
    fireEvent.click(screen.getByRole("option", { name: "13:30" }));

    expect(onChange).toHaveBeenCalledWith("13:30");
    expect(screen.queryByRole("dialog", { name: "Saat secimi" })).not.toBeInTheDocument();
  });

  it("uses the configured minute step for the time options", () => {
    renderWithProviders(
      <LocalizedTimeInput
        ariaLabel="Saat"
        onChange={vi.fn()}
        stepMinutes={15}
        value="09:00"
      />
    );

    fireEvent.focus(screen.getByLabelText("Saat"));

    expect(screen.getByRole("option", { name: "09:15" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "09:05" })).not.toBeInTheDocument();
  });

  it("allows manual entry when enabled", () => {
    const onChange = vi.fn();

    renderWithProviders(
      <LocalizedTimeInput
        allowManualInput
        ariaLabel="Saat"
        onChange={onChange}
        stepMinutes={15}
        value="09:00"
      />
    );

    fireEvent.change(screen.getByLabelText("Saat"), { target: { value: "10:45" } });

    expect(onChange).toHaveBeenCalledWith("10:45");
  });
});
