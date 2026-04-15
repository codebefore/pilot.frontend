import { fireEvent, screen, waitFor } from "@testing-library/react";
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
  NewGroupModal: () => null,
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
      pageSize: 12,
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

  it("loads terms and auto-selects the most recent term, then fetches groups scoped to it", async () => {
    renderWithProviders(<GroupsPage />);

    await waitFor(() => {
      expect(getTermsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(getGroupsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          termId: "term-1",
          page: 1,
          pageSize: 12,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("does not render a meb status filter and fetches groups without mebStatus", async () => {
    renderWithProviders(<GroupsPage />);

    await waitFor(() => expect(getGroupsMock).toHaveBeenCalled());

    expect(screen.queryByLabelText("MEB Durumu")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Grup ara...")).not.toBeInTheDocument();
    expect(getGroupsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        termId: "term-1",
        page: 1,
        pageSize: 12,
      }),
      expect.any(AbortSignal)
    );
    expect(getGroupsMock.mock.calls[getGroupsMock.mock.calls.length - 1]?.[0]).not.toHaveProperty(
      "mebStatus"
    );
  });

  it("skips the groups fetch until a term is selected", async () => {
    getTermsMock.mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 200,
      totalCount: 0,
      totalPages: 0,
    });

    renderWithProviders(<GroupsPage />);

    await waitFor(() => expect(getTermsMock).toHaveBeenCalled());
    // After terms resolve to an empty list, groups API should not be called.
    expect(getGroupsMock).not.toHaveBeenCalled();
  });

  it("defaults to the newest sibling term within the same month", async () => {
    getTermsMock.mockResolvedValueOnce({
      items: [term1, term2],
      page: 1,
      pageSize: 200,
      totalCount: 2,
      totalPages: 1,
    });

    renderWithProviders(<GroupsPage />);

    await waitFor(() => {
      expect(getGroupsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          termId: "term-2",
          page: 1,
          pageSize: 12,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("shows term actions as toolbar buttons when a term is selected", async () => {
    renderWithProviders(<GroupsPage />);

    expect(await screen.findByRole("button", { name: "Düzenle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sil" })).toBeInTheDocument();
  });

  it("renders the raw group title without stripping custom prefixes", async () => {
    getGroupsMock.mockResolvedValueOnce({
      items: [
        {
          id: "group-1",
          title: "B Sinifi - Hizlandirilmis",
          licenseClass: "B",
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
      pageSize: 12,
      totalCount: 1,
      totalPages: 1,
    });

    renderWithProviders(<GroupsPage />);

    expect(
      await screen.findByText("B Sinifi - Hizlandirilmis — Nisan 2026 - (B)")
    ).toBeInTheDocument();
  });

  it("deduplicates a legacy term suffix already embedded in the group title", async () => {
    getGroupsMock.mockResolvedValueOnce({
      items: [
        {
          id: "group-legacy",
          title: "1C Sinifi - Nisan 2026",
          licenseClass: "C",
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
      pageSize: 12,
      totalCount: 1,
      totalPages: 1,
    });

    renderWithProviders(<GroupsPage />);

    expect(await screen.findByText("1C Sinifi — Nisan 2026 - (C)")).toBeInTheDocument();
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
          licenseClass: "B",
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
      pageSize: 12,
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
          licenseClass: "B",
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
      pageSize: 12,
      totalCount: 1,
      totalPages: 1,
    });

    renderWithProviders(<GroupsPage />);

    await screen.findByText("1A — Nisan 2026 - (B)");
    fireEvent.click(screen.getByRole("button", { name: "Liste" }));

    expect(await screen.findByRole("columnheader", { name: "Grup" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Kontenjan" })).toBeInTheDocument();
    expect(screen.getByText("1A — Nisan 2026 - (B)")).toBeInTheDocument();
  });

  it("lets the user add optional columns from the picker in list view", async () => {
    getGroupsMock.mockResolvedValueOnce({
      items: [
        {
          id: "group-list-2",
          title: "1B",
          licenseClass: "A2",
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
      pageSize: 12,
      totalCount: 1,
      totalPages: 1,
    });

    renderWithProviders(<GroupsPage />);

    await screen.findByText("1B — Nisan 2026 - (A2)");
    fireEvent.click(screen.getByRole("button", { name: "Liste" }));

    expect(screen.queryByRole("columnheader", { name: "Ehliyet Tipi" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    fireEvent.click(screen.getByLabelText("Ehliyet Tipi"));

    expect(await screen.findByRole("columnheader", { name: "Ehliyet Tipi" })).toBeInTheDocument();
    expect(screen.getByText("A2")).toBeInTheDocument();
  });

  it("shows a specific message when term deletion is blocked by active groups", async () => {
    deleteTermMock.mockRejectedValueOnce(
      new ApiError(400, "Bad Request", {
        term: ["Term cannot be deleted while it still has groups with active candidates."],
      })
    );

    renderWithProviders(<GroupsPage />);

    expect(await screen.findByRole("button", { name: "Sil" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    fireEvent.click(screen.getByRole("button", { name: "Sil" }));

    expect(
      await screen.findByText("Dönem silinemiyor. İçinde aktif adayları olan grup var.")
    ).toBeInTheDocument();
  });
});
