import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { EditableRow } from "./EditableRow";

describe("EditableRow", () => {
  it("saves the current row and opens the next row when Tab is pressed", async () => {
    const saveFirst = vi.fn().mockResolvedValue(undefined);
    const saveSecond = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <div className="candidate-detail-edit-list">
        <EditableRow
          displayValue="Aktif"
          inputValue="active"
          label="Durum"
          onSave={saveFirst}
          options={[
            { value: "active", label: "Aktif" },
            { value: "dropped", label: "Ayrıldı" },
          ]}
        />
        <EditableRow
          displayValue="A-1"
          inputValue="A-1"
          label="Aday No"
          onSave={saveSecond}
        />
      </div>
    );

    fireEvent.click(screen.getAllByTitle("Düzenle")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Aktif" }));
    fireEvent.click(screen.getByRole("option", { name: "Ayrıldı" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Ayrıldı" }), {
      key: "Tab",
    });

    await waitFor(() => {
      expect(saveFirst).toHaveBeenCalledWith("dropped");
      expect(screen.getByRole("textbox", { name: "Aday No" })).toBeInTheDocument();
    });
  });
});
