import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/http";
import { GroupsPage } from "./GroupsPage";
import { renderWithProviders } from "../test/render-with-providers";

const getGroupsMock = vi.fn();
const getTermsMock = vi.fn();
const deleteTermMock = vi.fn();

vi.mock("../lib/groups-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/groups-api")>("../lib/groups-api");
  return {
    ...actual,
    getGroups: (...args: Parameters<typeof actual.getGroups>) => getGroupsMock(...args),
    getGroupById: vi.fn(),
    updateGroup: vi.fn(),
  };
});

vi.mock("../lib/terms-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/terms-api")>("../lib/terms-api");
  return {
    ...actual,
    getTerms: (...args: Parameters<typeof actual.getTerms>) => getTermsMock(...args),
    getTermById: vi.fn(),
    createTerm: vi.fn(),
    updateTerm: vi.fn(),
    deleteTerm: (...args: Parameters<typeof actual.deleteTerm>) => deleteTermMock(...args),
  };
});

vi.mock("../components/modals/NewGroupModal", () => ({
  NewGroupModal: ({ open }: { open: boolean }) =>
    open ? <div>Yeni Grup Modalı</div> : null,
}));

vi.mock("../components/modals/NewTermModal", () => ({
  NewTermModal: () => null,
}));

vi.mock("../components/drawers/GroupDrawer", () => ({
  GroupDrawer: () => null,
}));

const term1 = {
  id: "term-1",
  monthDate: "2026-04-01",
  sequence: 1,
  name: null,
  groupCount: 2,
  activeCandidateCount: 0,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
};

const term2 = {
  id: "term-2",
  monthDate: "2026-04-01",
  sequence: 2,
  name: "Ek Donem",
  groupCount: 1,
  activeCandidateCount: 0,
  createdAtUtc: "2026-01-02T00:00:00Z",
  updatedAtUtc: "2026-01-02T00:00:00Z",
};

describe("GroupsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    getGroupsMock.mockReset();
    getGroupsMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      totalCount: 0,
      totalPages: 1,
    });

    getTermsMock.mockReset();
    getTermsMock.mockResolvedValue({
      items: [term1],
      page: 1,
      pageSize: 200,
      totalCount: 1,
      totalPages: 1,
    });

    deleteTermMock.mockReset();
    deleteTermMock.mockResolvedValue(undefined);
  });

  it("loads terms and fetches all groups without a term filter by default", async () => {
    renderWithProviders(<GroupsPage />);

    await waitFor(() => {
      expect(getTermsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(getGroupsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 100,
        }),
        expect.any(AbortSignal)
      );
    });

    const params = getGroupsMock.mock.calls[0]?.[0];
    expect(params).not.toHaveProperty("termId");
    expect(screen.getByLabelText("Dönem")).toHaveValue("");
  });

  it("fetches and merges remaining group pages when more than one page exists", async () => {
    getGroupsMock
      .mockResolvedValueOnce({
        items: [
          {
            id: "group-page-1",
            title: "1A",
            term: {
              id: "term-1",
              monthDate: "2026-04-01",
              sequence: 1,
              name: null,
            },
            capacity: 20,
            assignedCandidateCount: 4,
            activeCandidateCount: 4,
            startDate: "2026-04-10",
            mebStatus: "sent",
            candidatePreview: [],
            createdAtUtc: "2026-04-12T10:00:00Z",
            updatedAtUtc: "2026-04-12T10:00:00Z",
          },
        ],
        page: 1,
        pageSize: 100,
        totalCount: 2,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "group-page-2",
            title: "1B",
            term: {
              id: "term-1",
              monthDate: "2026-04-01",
              sequence: 1,
              name: null,
            },
            capacity: 18,
            assignedCandidateCount: 3,
            activeCandidateCount: 3,
            startDate: "2026-04-12",
            mebStatus: "not_sent",
            candidatePreview: [],
            createdAtUtc: "2026-04-13T10:00:00Z",
            updatedAtUtc: "2026-04-13T10:00:00Z",
          },
        ],
        page: 2,
        pageSize: 100,
        totalCount: 2,
        totalPages: 2,
      });

    renderWithProviders(<GroupsPage />);

    expect(await screen.findByText("Nisan 2026 - 1A")).toBeInTheDocument();
    expect(await screen.findByText("Nisan 2026 - 1B")).toBeInTheDocument();

    await waitFor(() => {
      expect(getGroupsMock).toHaveBeenCalledTimes(2);
    });

    expect(getGroupsMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        page: 1,
        pageSize: 100,
      }),
      expect.any(AbortSignal)
    );
    expect(getGroupsMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        page: 2,
        pageSize: 100,
      }),
      expect.any(AbortSignal)
    );
    expect(getGroupsMock.mock.calls[0]?.[0]).not.toHaveProperty("termId");
    expect(getGroupsMock.mock.calls[1]?.[0]).not.toHaveProperty("termId");
  });

  it("does not render a meb status filter and fetches groups without mebStatus", async () => {
    renderWithProviders(<GroupsPage />);

    await waitFor(() => expect(getGroupsMock).toHaveBeenCalled());

    expect(screen.queryByLabelText("MEB Durumu")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Grup ara...")).not.toBeInTheDocument();
    expect(getGroupsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 100,
      }),
      expect.any(AbortSignal)
    );
    const lastParams = getGroupsMock.mock.calls[getGroupsMock.mock.calls.length - 1]?.[0];
    expect(lastParams).not.toHaveProperty("mebStatus");
    expect(lastParams).not.toHaveProperty("termId");
  });

  it("still fetches groups when there are no terms yet", async () => {
    getTermsMock.mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 200,
      totalCount: 0,
      totalPages: 0,
    });

    renderWithProviders(<GroupsPage />);

    await waitFor(() => expect(getTermsMock).toHaveBeenCalled());
    await waitFor(() => expect(getGroupsMock).toHaveBeenCalled());
  });

  it("opens the new group modal when the toolbar button is clicked", async () => {
    renderWithProviders(<GroupsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Yeni Grup" }));

    expect(await screen.findByText("Yeni Grup Modalı")).toBeInTheDocument();
  });

  it("keeps the term filter unselected until the user picks one", async () => {
    getTermsMock.mockResolvedValueOnce({
      items: [term1, term2],
      page: 1,
      pageSize: 200,
      totalCount: 2,
      totalPages: 1,
    });

    renderWithProviders(<GroupsPage />);

    expect(await screen.findByLabelText("Dönem")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("Dönem"), { target: { value: "term-2" } });

    await waitFor(() => {
      expect(getGroupsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          termId: "term-2",
          page: 1,
          pageSize: 100,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("shows term actions as toolbar buttons when a term is selected", async () => {
    renderWithProviders(<GroupsPage />);

    expect(screen.queryByRole("button", { name: "Düzenle" })).not.toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText("Dönem"), { target: { value: "term-1" } });

    expect(await screen.findByRole("button", { name: "Düzenle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sil" })).toBeInTheDocument();
  });

  it("groups cards into term sections and shows aggregate term totals", async () => {
    getTermsMock.mockResolvedValueOnce({
      items: [term1, term2],
      page: 1,
      pageSize: 200,
      totalCount: 2,
      totalPages: 1,
    });
    getGroupsMock.mockResolvedValueOnce({
      items: [
        {
          id: "group-1",
          title: "1A",
          term: {
            id: "term-1",
            monthDate: "2026-04-01",
            sequence: 1,
            name: null,
          },
          capacity: 20,
          assignedCandidateCount: 4,
          activeCandidateCount: 4,
          startDate: "2026-04-10",
          mebStatus: "sent",
          candidatePreview: [],
          createdAtUtc: "2026-04-12T10:00:00Z",
          updatedAtUtc: "2026-04-12T10:00:00Z",
        },
        {
          id: "group-2",
          title: "1B",
          term: {
            id: "term-1",
            monthDate: "2026-04-01",
            sequence: 1,
            name: null,
          },
          capacity: 10,
          assignedCandidateCount: 2,
          activeCandidateCount: 2,
          startDate: "2026-04-12",
          mebStatus: "not_sent",
          candidatePreview: [],
          createdAtUtc: "2026-04-13T10:00:00Z",
          updatedAtUtc: "2026-04-13T10:00:00Z",
        },
        {
          id: "group-3",
          title: "2A",
          term: {
            id: "term-2",
            monthDate: "2026-04-01",
            sequence: 2,
            name: "Ek Donem",
          },
          capacity: 15,
          assignedCandidateCount: 3,
          activeCandidateCount: 3,
          startDate: "2026-04-15",
          mebStatus: "sent",
          candidatePreview: [],
          createdAtUtc: "2026-04-14T10:00:00Z",
          updatedAtUtc: "2026-04-14T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 3,
      totalPages: 1,
    });

    renderWithProviders(<GroupsPage />);

    const primarySectionHeading = await screen.findByRole("heading", { name: "Nisan 2026 / 1" });
    const primarySection = primarySectionHeading.closest("section");
    expect(primarySection).not.toBeNull();
    if (!primarySection) {
      throw new Error("Expected primary section");
    }
    const primarySectionQueries = within(primarySection);

    expect(screen.getByRole("heading", { name: "Nisan 2026 / 2 - Ek Donem" })).toBeInTheDocument();
    expect(primarySectionQueries.getByText("Toplam Kontenjan")).toBeInTheDocument();
    expect(primarySectionQueries.getByText("Aktif Aday")).toBeInTheDocument();
    expect(primarySectionQueries.getByText("30")).toBeInTheDocument();
    expect(primarySectionQueries.getByText("6")).toBeInTheDocument();
    expect(primarySectionQueries.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Nisan 2026 - 1A")).toBeInTheDocument();
    expect(screen.getByText("Nisan 2026 - 1B")).toBeInTheDocument();
    expect(screen.getByText("Nisan 2026 - 2A")).toBeInTheDocument();
  });

  it("groups list view into term sections and keeps a single column picker", async () => {
    getTermsMock.mockResolvedValueOnce({
      items: [term1, term2],
      page: 1,
      pageSize: 200,
      totalCount: 2,
      totalPages: 1,
    });
    getGroupsMock.mockResolvedValueOnce({
      items: [
        {
          id: "group-list-a",
          title: "1A",
          term: {
            id: "term-1",
            monthDate: "2026-04-01",
            sequence: 1,
            name: null,
          },
          capacity: 20,
          assignedCandidateCount: 4,
          activeCandidateCount: 4,
          startDate: "2026-04-10",
          mebStatus: "sent",
          candidatePreview: [],
          createdAtUtc: "2026-04-12T10:00:00Z",
          updatedAtUtc: "2026-04-12T10:00:00Z",
        },
        {
          id: "group-list-b",
          title: "2A",
          term: {
            id: "term-2",
            monthDate: "2026-04-01",
            sequence: 2,
            name: "Ek Donem",
          },
          capacity: 15,
          assignedCandidateCount: 3,
          activeCandidateCount: 3,
          startDate: "2026-04-15",
          mebStatus: "sent",
          candidatePreview: [],
          createdAtUtc: "2026-04-14T10:00:00Z",
          updatedAtUtc: "2026-04-14T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 2,
      totalPages: 1,
    });

    renderWithProviders(<GroupsPage />);

    await screen.findByText("Nisan 2026 - 1A");
    fireEvent.click(screen.getByRole("button", { name: "Liste" }));

    expect(await screen.findByRole("heading", { name: "Nisan 2026 / 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nisan 2026 / 2 - Ek Donem" })).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Sütunlar" })).toHaveLength(1);
  });

  it("renders the group code with the term label", async () => {
    getGroupsMock.mockResolvedValueOnce({
      items: [
        {
          id: "group-1",
          title: "2B",
          term: {
            id: "term-1",
            monthDate: "2026-04-01",
            sequence: 1,
            name: null,
          },
          capacity: 20,
          assignedCandidateCount: 4,
          activeCandidateCount: 4,
          startDate: "2026-04-10",
          mebStatus: "sent",
          candidatePreview: [],
          createdAtUtc: "2026-04-12T10:00:00Z",
          updatedAtUtc: "2026-04-12T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 1,
      totalPages: 1,
    });

    renderWithProviders(<GroupsPage />);

    expect(await screen.findByText("Nisan 2026 - 2B")).toBeInTheDocument();
  });

  it("deduplicates a legacy term suffix already embedded in the group title", async () => {
    getGroupsMock.mockResolvedValueOnce({
      items: [
        {
          id: "group-legacy",
          title: "1C Sinifi - Nisan 2026",
          term: {
            id: "term-1",
            monthDate: "2026-04-01",
            sequence: 1,
            name: null,
          },
          capacity: 12,
          assignedCandidateCount: 2,
          activeCandidateCount: 2,
          startDate: "2026-04-07",
          mebStatus: "sent",
          candidatePreview: [],
          createdAtUtc: "2026-04-12T10:00:00Z",
          updatedAtUtc: "2026-04-12T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 1,
      totalPages: 1,
    });

    renderWithProviders(<GroupsPage />);

    expect(await screen.findByText("1C Sinifi — Nisan 2026")).toBeInTheDocument();
    expect(
      screen.queryByText("1C Sinifi - Nisan 2026 — Nisan 2026")
    ).not.toBeInTheDocument();
  });

  it("renders candidate preview avatars in card view", async () => {
    getGroupsMock.mockResolvedValueOnce({
      items: [
        {
          id: "group-preview",
          title: "1A",
          term: {
            id: "term-1",
            monthDate: "2026-04-01",
            sequence: 1,
            name: null,
          },
          capacity: 20,
          assignedCandidateCount: 3,
          activeCandidateCount: 3,
          startDate: "2026-04-10",
          mebStatus: "sent",
          candidatePreview: [
            {
              candidateId: "candidate-1",
              firstName: "Ada",
              lastName: "Yilmaz",
              photo: {
                documentId: "doc-1",
                kind: "biometric_photo",
              },
            },
            {
              candidateId: "candidate-2",
              firstName: "Mert",
              lastName: "Kaya",
              photo: null,
            },
          ],
          createdAtUtc: "2026-04-12T10:00:00Z",
          updatedAtUtc: "2026-04-12T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 1,
      totalPages: 1,
    });

    renderWithProviders(<GroupsPage />);

    expect(await screen.findByRole("img", { name: "Ada Yilmaz" })).toBeInTheDocument();
    expect(screen.getByText("MK")).toBeInTheDocument();
  });

  it("supports switching to list view", async () => {
    getGroupsMock.mockResolvedValueOnce({
      items: [
        {
          id: "group-list-1",
          title: "1A",
          term: {
            id: "term-1",
            monthDate: "2026-04-01",
            sequence: 1,
            name: null,
          },
          capacity: 20,
          assignedCandidateCount: 5,
          activeCandidateCount: 5,
          startDate: "2026-04-10",
          mebStatus: "sent",
          candidatePreview: [],
          createdAtUtc: "2026-04-12T10:00:00Z",
          updatedAtUtc: "2026-04-12T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 1,
      totalPages: 1,
    });

    renderWithProviders(<GroupsPage />);

    await screen.findByText("Nisan 2026 - 1A");
    fireEvent.click(screen.getByRole("button", { name: "Liste" }));

    expect(await screen.findByRole("heading", { name: "Nisan 2026" })).toBeInTheDocument();
    expect(await screen.findByRole("columnheader", { name: "Grup" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Kontenjan" })).toBeInTheDocument();
    expect(screen.getByText("Nisan 2026 - 1A")).toBeInTheDocument();
  });

  it("lets the user add optional columns from the picker in list view", async () => {
    getGroupsMock.mockResolvedValueOnce({
      items: [
        {
          id: "group-list-2",
          title: "1B",
          term: {
            id: "term-1",
            monthDate: "2026-04-01",
            sequence: 1,
            name: null,
          },
          capacity: 18,
          assignedCandidateCount: 6,
          activeCandidateCount: 5,
          startDate: "2026-04-12",
          mebStatus: "not_sent",
          candidatePreview: [],
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-13T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 1,
      totalPages: 1,
    });

    renderWithProviders(<GroupsPage />);

    await screen.findByText("Nisan 2026 - 1B");
    fireEvent.click(screen.getByRole("button", { name: "Liste" }));

    expect(screen.queryByRole("columnheader", { name: "Aktif Aday" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    fireEvent.click(screen.getByLabelText("Aktif Aday"));

    expect(await screen.findByRole("columnheader", { name: "Aktif Aday" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "5" })).toBeInTheDocument();
  });

  it("shows a specific message when term deletion is blocked by active groups", async () => {
    deleteTermMock.mockRejectedValueOnce(
      new ApiError(400, "Bad Request", {
        term: ["Term cannot be deleted while it still has groups with active candidates."],
      })
    );

    renderWithProviders(<GroupsPage />);

    fireEvent.change(await screen.findByLabelText("Dönem"), { target: { value: "term-1" } });
    expect(await screen.findByRole("button", { name: "Sil" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    fireEvent.click(screen.getByRole("button", { name: "Sil" }));

    expect(
      await screen.findByText("Dönem silinemiyor. İçinde aktif adayları olan grup var.")
    ).toBeInTheDocument();
  });
});
