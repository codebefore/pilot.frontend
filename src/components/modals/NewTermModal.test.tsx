import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/http";
import { renderWithProviders } from "../../test/render-with-providers";
import { NewTermModal } from "./NewTermModal";

const createTermMock = vi.fn();
const updateTermMock = vi.fn();

vi.mock("../../lib/terms-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/terms-api")>("../../lib/terms-api");
  return {
    ...actual,
    createTerm: (...args: Parameters<typeof actual.createTerm>) => createTermMock(...args),
    updateTerm: (...args: Parameters<typeof actual.updateTerm>) => updateTermMock(...args),
  };
});

describe("NewTermModal", () => {
  it("opens in edit mode and updates the selected term from a popup", async () => {
    updateTermMock.mockResolvedValue({
      id: "term-1",
      monthDate: "2026-04-01",
      sequence: 1,
      name: "EK DÖNEM",
      groupCount: 0,
      activeCandidateCount: 0,
      licenseClassCounts: [],
      createdAtUtc: "2026-04-01T00:00:00Z",
      updatedAtUtc: "2026-04-02T00:00:00Z",
    });

    const onSaved = vi.fn();

    renderWithProviders(
      <NewTermModal
        onClose={() => {}}
        onSaved={onSaved}
        open
        term={{
          id: "term-1",
          monthDate: "2026-04-01",
          sequence: 1,
          name: "NİSAN DÖNEMİ",
          groupCount: 2,
          activeCandidateCount: 0,
          licenseClassCounts: [],
          createdAtUtc: "2026-04-01T00:00:00Z",
          updatedAtUtc: "2026-04-01T00:00:00Z",
        }}
      />
    );

    expect(screen.getByText("Dönemi Düzenle")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Örn. Ek Dönem"), {
      target: { value: "EK DÖNEM" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateTermMock).toHaveBeenCalledWith("term-1", {
        monthDate: "2026-04-01",
        name: "EK DÖNEM",
      });
    });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "term-1",
        name: "EK DÖNEM",
      })
    );
    expect(createTermMock).not.toHaveBeenCalled();
  });

  it("shows a field error when target month already has another term and name is missing", async () => {
    updateTermMock.mockRejectedValue(
      new ApiError(400, "Bad Request", {
        Name: ["Name is required when another term already exists in the same month."],
      })
    );

    renderWithProviders(
      <NewTermModal
        onClose={() => {}}
        onSaved={() => {}}
        open
        term={{
          id: "term-1",
          monthDate: "2026-04-01",
          sequence: 1,
          name: null,
          groupCount: 0,
          activeCandidateCount: 0,
          licenseClassCounts: [],
          createdAtUtc: "2026-04-01T00:00:00Z",
          updatedAtUtc: "2026-04-01T00:00:00Z",
        }}
      />
    );

    fireEvent.change(screen.getByLabelText("Ay"), {
      target: { value: "2026-05" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(
      await screen.findByText("Name is required when another term already exists in the same month.")
    ).toBeInTheDocument();
  });
});
