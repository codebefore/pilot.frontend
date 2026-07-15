import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalizedTimeInput } from "./LocalizedTimeInput";
import { renderWithProviders } from "../../test/render-with-providers";

const originalInnerHeight = window.innerHeight;
const originalInnerWidth = window.innerWidth;

describe("LocalizedTimeInput", () => {
  afterEach(() => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
  });

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

  it("opens above the field when the viewport has no room below", () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });
    renderWithProviders(
      <LocalizedTimeInput
        ariaLabel="Saat"
        onChange={vi.fn()}
        value="09:00"
      />
    );

    const input = screen.getByLabelText("Saat");
    const field = input.closest(".localized-date-field");
    vi.spyOn(field as HTMLElement, "getBoundingClientRect").mockReturnValue({
      bottom: 580,
      height: 30,
      left: 120,
      right: 320,
      top: 550,
      width: 200,
      x: 120,
      y: 550,
      toJSON: () => ({}),
    });

    fireEvent.focus(input);

    const popover = screen.getByRole("dialog", { name: "Saat secimi" });
    expect(popover).toHaveStyle({ position: "fixed", width: "200px" });
    expect(Number.parseFloat(popover.style.top)).toBeLessThan(550);
  });

  it("keeps the popover width inside a narrow viewport", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 160 });
    renderWithProviders(
      <LocalizedTimeInput ariaLabel="Saat" onChange={vi.fn()} value="09:00" />
    );

    const input = screen.getByLabelText("Saat");
    const field = input.closest(".localized-date-field");
    vi.spyOn(field as HTMLElement, "getBoundingClientRect").mockReturnValue({
      bottom: 130,
      height: 30,
      left: 8,
      right: 208,
      top: 100,
      width: 200,
      x: 8,
      y: 100,
      toJSON: () => ({}),
    });

    fireEvent.focus(input);

    expect(screen.getByRole("dialog", { name: "Saat secimi" })).toHaveStyle({
      left: "8px",
      width: "144px",
    });
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
