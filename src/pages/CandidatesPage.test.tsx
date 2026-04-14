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

  it("defaults to the 'active' tab and sends status='active'", async () => {
    renderPage();

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenCalled();
    });

    const callArgs = getCandidatesMock.mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({ status: "active", page: 1, pageSize: 10 });
  });

  it("renders exactly the 5 canonical candidate status tabs", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: "Onkayit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aktif" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Park" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mezun" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dosya Yakan" })).toBeInTheDocument();

    // Legacy tabs must not exist anymore.
    expect(screen.queryByRole("button", { name: "Tüm Adaylar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tamamlanan" })).not.toBeInTheDocument();
  });

  it("sends status='pre_registered' when the Onkayit tab is selected", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Onkayit" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "pre_registered",
          page: 1,
          pageSize: 10,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("sends status='graduated' when the Mezun tab is selected", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Mezun" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "graduated",
          page: 1,
          pageSize: 10,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("sends status='dropped' when the Dosya Yakan tab is selected", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Dosya Yakan" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "dropped",
          page: 1,
          pageSize: 10,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("renders only the search input and tabs; other filters are removed", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    // The search input is still there.
    expect(screen.getByPlaceholderText("Aday ara... (ad, soyad, TC)")).toBeInTheDocument();

    // Removed filter dropdowns should no longer be rendered.
    expect(screen.queryByLabelText("Lisans Sınıfı")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Grup Durumu")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Evrak")).not.toBeInTheDocument();

    // And the clear-filters button should not be present either.
    expect(screen.queryByRole("button", { name: /Filtreleri Temizle/i })).not.toBeInTheDocument();
  });
});

describe("CandidatesPage sorting", () => {
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

  it("does not send sort params on initial load", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    const callArgs = getCandidatesMock.mock.calls[0]?.[0];
    expect(callArgs.sortBy).toBeUndefined();
    expect(callArgs.sortDir).toBeUndefined();
  });

  it("cycles Ad Soyad header through asc → desc → unsorted", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    const header = screen.getByRole("button", { name: /Ad Soyad/ });

    // First click → ascending.
    fireEvent.click(header);
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sortBy: "name",
          sortDir: "asc",
          page: 1,
        }),
        expect.any(AbortSignal)
      );
    });

    // Second click → descending.
    fireEvent.click(header);
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sortBy: "name",
          sortDir: "desc",
          page: 1,
        }),
        expect.any(AbortSignal)
      );
    });

    // Third click → unsorted (no sort params).
    fireEvent.click(header);
    await waitFor(() => {
      const lastCall =
        getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1]?.[0];
      expect(lastCall.sortBy).toBeUndefined();
      expect(lastCall.sortDir).toBeUndefined();
    });
  });

  it("sends sort params together with the active tab filter", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    // Switch away from the default "active" tab to prove sort+tab coexist.
    fireEvent.click(screen.getByRole("button", { name: "Mezun" }));
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "graduated" }),
        expect.any(AbortSignal)
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Grup/ }));
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "graduated",
          sortBy: "groupTitle",
          sortDir: "asc",
          page: 1,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("resets page to 1 when a new sort is applied", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 10,
      totalCount: 25,
      totalPages: 3,
    });

    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    // Navigate to page 2.
    fireEvent.click(screen.getByRole("button", { name: /Sonraki/ }));
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
        expect.any(AbortSignal)
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /TC Kimlik/ }));
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sortBy: "nationalId",
          sortDir: "asc",
          page: 1,
        }),
        expect.any(AbortSignal)
      );
    });
  });
});
