import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CheckboxListPopover } from "./CheckboxListPopover";

describe("CheckboxListPopover", () => {
  it("filters searchable options with Turkish diacritic-insensitive matching", async () => {
    render(
      <CheckboxListPopover
        onChange={vi.fn()}
        options={[
          { value: "agustos", label: "AĞUSTOS 2026" },
          { value: "temmuz", label: "TEMMUZ 2026" },
        ]}
        searchable
        title="Dönem"
        values={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Dönem" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Ara" }), {
      target: { value: "agustos" },
    });

    expect(screen.getByText("AĞUSTOS 2026")).toBeInTheDocument();
    expect(screen.queryByText("TEMMUZ 2026")).not.toBeInTheDocument();
  });
});
