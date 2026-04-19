import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/http";
import { renderWithProviders } from "../../test/render-with-providers";
import { NewGroupModal } from "./NewGroupModal";

const createGroupMock = vi.fn();
const getGroupsMock = vi.fn();
const getTermsMock = vi.fn();

vi.mock("../../lib/groups-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/groups-api")>("../../lib/groups-api");
  return {
    ...actual,
    createGroup: (...args: Parameters<typeof actual.createGroup>) => createGroupMock(...args),
    getGroups: (...args: Parameters<typeof actual.getGroups>) => getGroupsMock(...args),
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
  beforeEach(() => {
    createGroupMock.mockReset();
    getGroupsMock.mockReset();
    getTermsMock.mockReset();
    getGroupsMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      totalCount: 0,
      totalPages: 0,
    });
  });

  it("defaults group number and branch to 1A", async () => {
    getTermsMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 200,
      totalCount: 0,
      totalPages: 0,
    });

    renderWithProviders(
      <NewGroupModal
        initialTermId={null}
        onClose={() => {}}
        onSubmit={() => {}}
        open
      />
    );

    const groupNumberSelect = document.querySelector('select[name="groupNumber"]');
    const groupBranchSelect = document.querySelector('select[name="groupBranch"]');
    expect((groupNumberSelect as HTMLSelectElement).value).toBe("1");
    expect((groupBranchSelect as HTMLSelectElement).value).toBe("A");
  });

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

    await screen.findAllByText("Nisan 2026");

    const groupNumberSelect = document.querySelector('select[name="groupNumber"]');
    const groupBranchSelect = document.querySelector('select[name="groupBranch"]');
    expect(groupNumberSelect).not.toBeNull();
    expect(groupBranchSelect).not.toBeNull();
    fireEvent.change(groupNumberSelect!, {
      target: { value: "2" },
    });
    fireEvent.change(groupBranchSelect!, {
      target: { value: "C" },
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

  it("suggests the next available group number and branch from existing groups", async () => {
    getTermsMock.mockResolvedValue({
      items: [
        {
          id: "term-1",
          monthDate: "2026-04-01",
          sequence: 1,
          name: null,
          groupCount: 2,
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
    getGroupsMock.mockResolvedValue({
      items: [
        {
          id: "group-1",
          title: "1A",
          capacity: 20,
          activeCandidateCount: 0,
          termId: "term-1",
          termMonthDate: "2026-04-01",
          mebStatus: "not_sent",
          startDate: "2026-04-02",
          archived: false,
          createdAtUtc: "2026-04-01T00:00:00Z",
          updatedAtUtc: "2026-04-01T00:00:00Z",
        },
        {
          id: "group-2",
          title: "2B",
          capacity: 20,
          activeCandidateCount: 0,
          termId: "term-1",
          termMonthDate: "2026-04-01",
          mebStatus: "not_sent",
          startDate: "2026-04-03",
          archived: false,
          createdAtUtc: "2026-04-01T00:00:00Z",
          updatedAtUtc: "2026-04-01T00:00:00Z",
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 2,
      totalPages: 1,
    });

    renderWithProviders(
      <NewGroupModal
        initialTermId="term-1"
        onClose={() => {}}
        onSubmit={() => {}}
        open
      />
    );

    await screen.findAllByText("Nisan 2026");

    await waitFor(() => {
      const groupNumberSelect = document.querySelector('select[name="groupNumber"]');
      const groupBranchSelect = document.querySelector('select[name="groupBranch"]');
      expect((groupNumberSelect as HTMLSelectElement).value).toBe("1");
      expect((groupBranchSelect as HTMLSelectElement).value).toBe("B");
    });

    expect(getGroupsMock).toHaveBeenCalledWith(
      {
        termId: "term-1",
        page: 1,
        pageSize: 100,
      },
      expect.any(AbortSignal)
    );
  });

  it("submits the selected group number and branch", async () => {
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
    createGroupMock.mockResolvedValue({});

    renderWithProviders(
      <NewGroupModal
        initialTermId="term-1"
        onClose={() => {}}
        onSubmit={() => {}}
        open
      />
    );

    await screen.findAllByText("Nisan 2026");

    const groupNumberSelect = document.querySelector('select[name="groupNumber"]');
    const groupBranchSelect = document.querySelector('select[name="groupBranch"]');
    const termSelect = document.querySelector('select[name="termId"]');
    const startDateInput = document.querySelector('input[type="date"]');

    fireEvent.change(groupNumberSelect!, { target: { value: "4" } });
    fireEvent.change(groupBranchSelect!, { target: { value: "D" } });
    fireEvent.change(termSelect!, { target: { value: "term-1" } });
    fireEvent.change(startDateInput!, { target: { value: "2026-04-03" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createGroupMock).toHaveBeenCalledWith(
        expect.objectContaining({
          groupNumber: 4,
          groupBranch: "D",
        })
      );
    });
  });

  it("does not override a manually selected group code when suggestions load later", async () => {
    let resolveGroups: ((value: Record<string, unknown>) => void) | undefined;

    getTermsMock.mockResolvedValue({
      items: [
        {
          id: "term-1",
          monthDate: "2026-04-01",
          sequence: 1,
          name: null,
          groupCount: 2,
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
    getGroupsMock.mockReturnValue(
      new Promise<Record<string, unknown>>((resolve) => {
        resolveGroups = resolve;
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

    await screen.findAllByText("Nisan 2026");
    await waitFor(() => expect(getGroupsMock).toHaveBeenCalled());

    const groupNumberSelect = document.querySelector('select[name="groupNumber"]');
    const groupBranchSelect = document.querySelector('select[name="groupBranch"]');
    expect(groupNumberSelect).not.toBeNull();
    expect(groupBranchSelect).not.toBeNull();

    fireEvent.change(groupNumberSelect!, { target: { value: "4" } });
    fireEvent.change(groupBranchSelect!, { target: { value: "D" } });

    expect(resolveGroups).toBeDefined();
    resolveGroups!({
      items: [
        {
          id: "group-1",
          title: "1A",
        },
        {
          id: "group-2",
          title: "2B",
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 2,
      totalPages: 1,
    });

    await waitFor(() => {
      expect((groupNumberSelect as HTMLSelectElement).value).toBe("4");
      expect((groupBranchSelect as HTMLSelectElement).value).toBe("D");
    });
  });

  it("suggests the first empty branch for the selected number", async () => {
    getTermsMock.mockResolvedValue({
      items: [
        {
          id: "term-1",
          monthDate: "2026-04-01",
          sequence: 1,
          name: null,
          groupCount: 3,
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
    getGroupsMock.mockResolvedValue({
      items: [
        { id: "group-1", title: "1A" },
        { id: "group-2", title: "1B" },
        { id: "group-3", title: "2A" },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 3,
      totalPages: 1,
    });

    renderWithProviders(
      <NewGroupModal
        initialTermId="term-1"
        onClose={() => {}}
        onSubmit={() => {}}
        open
      />
    );

    await screen.findAllByText("Nisan 2026");
    await waitFor(() => {
      const groupNumberSelect = document.querySelector('select[name="groupNumber"]');
      const groupBranchSelect = document.querySelector('select[name="groupBranch"]');
      expect((groupNumberSelect as HTMLSelectElement).value).toBe("1");
      expect((groupBranchSelect as HTMLSelectElement).value).toBe("C");
    });

    const groupNumberSelect = document.querySelector('select[name="groupNumber"]');
    const groupBranchSelect = document.querySelector('select[name="groupBranch"]');
    expect(groupNumberSelect).not.toBeNull();
    expect(groupBranchSelect).not.toBeNull();

    fireEvent.change(groupNumberSelect!, { target: { value: "2" } });

    await waitFor(() => {
      expect((groupBranchSelect as HTMLSelectElement).value).toBe("B");
    });
  });

  it("uses branch A when the selected number has no existing groups", async () => {
    getTermsMock.mockResolvedValue({
      items: [
        {
          id: "term-1",
          monthDate: "2026-04-01",
          sequence: 1,
          name: null,
          groupCount: 2,
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
    getGroupsMock.mockResolvedValue({
      items: [
        { id: "group-1", title: "1A" },
        { id: "group-2", title: "2B" },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 2,
      totalPages: 1,
    });

    renderWithProviders(
      <NewGroupModal
        initialTermId="term-1"
        onClose={() => {}}
        onSubmit={() => {}}
        open
      />
    );

    await screen.findAllByText("Nisan 2026");

    const groupNumberSelect = document.querySelector('select[name="groupNumber"]');
    const groupBranchSelect = document.querySelector('select[name="groupBranch"]');
    expect(groupNumberSelect).not.toBeNull();
    expect(groupBranchSelect).not.toBeNull();

    fireEvent.change(groupNumberSelect!, { target: { value: "2" } });

    await waitFor(() => {
      expect((groupBranchSelect as HTMLSelectElement).value).toBe("A");
    });
  });
});
