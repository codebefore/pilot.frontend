import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("enables save after a form change and disables it again after saving", async () => {
    renderWithProviders(<SettingsPage />);

    const saveButton = screen.getByRole("button", { name: "Kaydet" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByDisplayValue("Sezer Surucu Kursu"), {
      target: { value: "Sezer Akademi" },
    });

    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });
  });
});
