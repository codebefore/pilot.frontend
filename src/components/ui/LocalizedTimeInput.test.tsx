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
});
