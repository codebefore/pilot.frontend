import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CandidatesPage } from "./CandidatesPage";
import { renderWithProviders } from "../test/render-with-providers";

const getCandidatesMock = vi.fn();

vi.mock("../lib/candidates-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/candidates-api")>(
    "../lib/candidates-api"
  );
  return {
    ...actual,
    getCandidates: (...args: Parameters<typeof actual.getCandidates>) =>
      getCandidatesMock(...args),
    getCandidateById: vi.fn(),
    createCandidate: vi.fn(),
    updateCandidate: vi.fn(),
    deleteCandidate: vi.fn(),
    assignCandidateGroup: vi.fn(),
    removeActiveGroupAssignment: vi.fn(),
  };
});

vi.mock("../lib/documents-api", () => ({
  getDocumentChecklist: vi.fn().mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 1,
    totalCount: 0,
    totalPages: 1,
  }),
  getDocumentTypes: vi.fn().mockResolvedValue([]),
  uploadDocument: vi.fn(),
}));

vi.mock("../components/drawers/CandidateDrawer", () => ({
  CandidateDrawer: () => null,
}));

vi.mock("../components/modals/NewCandidateModal", () => ({
  NewCandidateModal: () => null,
}));

function renderPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/candidates"]}>
      <CandidatesPage />
    </MemoryRouter>
  );
}

describe("CandidatesPage tabs", () => {
  beforeEach(() => {
    getCandidatesMock.mockReset();
    getCandidatesMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalCount: 0,
      totalPages: 1,
    });
  });

  it("defaults to the 'all' tab and sends no status filter", async () => {
    renderPage();

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenCalled();
    });

    const callArgs = getCandidatesMock.mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({ page: 1, pageSize: 10 });
    expect(callArgs.status).toBeUndefined();
  });

  it("sends status='active' when the active tab is selected", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Aktif" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          page: 1,
          pageSize: 10,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("sends status='completed' when the completed tab is selected", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Tamamlanan" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "completed",
          page: 1,
          pageSize: 10,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("does not render the misleading 'Aktif Dönem' label", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());
    expect(screen.queryByText("Aktif Dönem")).not.toBeInTheDocument();
  });
});
