import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/http";
import { renderWithProviders } from "../../test/render-with-providers";
import { NewGroupModal } from "./NewGroupModal";

const createGroupMock = vi.fn();
const getTermsMock = vi.fn();

vi.mock("../../lib/groups-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/groups-api")>("../../lib/groups-api");
  return {
    ...actual,
    createGroup: (...args: Parameters<typeof actual.createGroup>) => createGroupMock(...args),
  };
});

vi.mock("../../lib/terms-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/terms-api")>("../../lib/terms-api");
  return {
    ...actual,
    getTerms: (...args: Parameters<typeof actual.getTerms>) => getTermsMock(...args),
  };
});

describe("NewGroupModal", () => {
  it("shows a clear field error when start date is outside the selected term month", async () => {
    getTermsMock.mockResolvedValue({
      items: [
        {
          id: "term-1",
          monthDate: "2026-04-01",
          sequence: 1,
          name: null,
          groupCount: 0,
          activeCandidateCount: 0,
          createdAtUtc: "2026-04-01T00:00:00Z",
          updatedAtUtc: "2026-04-01T00:00:00Z",
        },
      ],
      page: 1,
      pageSize: 200,
      totalCount: 1,
      totalPages: 1,
    });

    createGroupMock.mockRejectedValue(
      new ApiError(400, "Bad Request", {
        StartDate: ["Start date must be inside the selected term month."],
      })
    );

    renderWithProviders(
      <NewGroupModal
        initialTermId="term-1"
        onClose={() => {}}
        onSubmit={() => {}}
        open
      />
    );

    fireEvent.change(await screen.findByPlaceholderText("1A"), {
      target: { value: "1A" },
    });
    const termSelect = document.querySelector('select[name="termId"]');
    expect(termSelect).not.toBeNull();
    fireEvent.change(termSelect!, {
      target: { value: "term-1" },
    });
    const startDateInput = document.querySelector('input[type="date"]');
    expect(startDateInput).not.toBeNull();
    fireEvent.change(startDateInput!, {
      target: { value: "2026-05-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(
        screen.getAllByText("Baslangic tarihi secilen donemin ayi icinde olmali: Nisan 2026.")
          .length
      ).toBeGreaterThan(0);
    });
  });
});
