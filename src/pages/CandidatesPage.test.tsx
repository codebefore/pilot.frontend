import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CandidatesPage } from "./CandidatesPage";
import { ExamUygulamaPage } from "./ExamUygulamaPage";
import { ExamESinavPage } from "./ExamESinavPage";
import { CandidateExamDateSidebar } from "../components/candidates/CandidateExamDateSidebar";
import { renderWithProviders } from "../test/render-with-providers";

const getCandidatesMock = vi.fn();
const getExamScheduleOptionsMock = vi.fn();
const getCandidateByIdMock = vi.fn();
const updateCandidateMock = vi.fn();
const updateCandidateTagMock = vi.fn();
const deleteCandidateTagMock = vi.fn();
const searchCandidateTagsMock = vi.fn();
const assignCandidateGroupMock = vi.fn();
const getGroupsMock = vi.fn();
const getExamCodesMock = vi.fn();
const listCandidateExamAttemptsMock = vi.fn();
const createCandidateExamAttemptMock = vi.fn();
const updateCandidateExamAttemptMock = vi.fn();
const chargeCandidateExamAttemptMock = vi.fn();
const getLicenseClassFeeMatrixMock = vi.fn();

vi.mock("../lib/authorized-files", () => ({
  createAuthorizedObjectUrl: (url: string) => Promise.resolve(url),
  openAuthorizedFile: vi.fn(),
  downloadAuthorizedFile: vi.fn(),
  printAuthorizedFile: vi.fn(),
}));

vi.mock("../lib/candidates-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/candidates-api")>(
    "../lib/candidates-api"
  );
  return {
    ...actual,
    getCandidates: (...args: Parameters<typeof actual.getCandidates>) =>
      getCandidatesMock(args[0]),
    getCandidateById: (...args: Parameters<typeof actual.getCandidateById>) =>
      getCandidateByIdMock(...args),
    createCandidate: vi.fn(),
    createCandidateTag: vi.fn(),
    updateCandidate: (...args: Parameters<typeof actual.updateCandidate>) =>
      updateCandidateMock(...args),
    updateCandidateTag: (...args: Parameters<typeof actual.updateCandidateTag>) =>
      updateCandidateTagMock(...args),
    deleteCandidateTag: (...args: Parameters<typeof actual.deleteCandidateTag>) =>
      deleteCandidateTagMock(...args),
    deleteCandidate: vi.fn(),
    assignCandidateGroup: (...args: Parameters<typeof actual.assignCandidateGroup>) =>
      assignCandidateGroupMock(...args),
    removeActiveGroupAssignment: vi.fn(),
    searchCandidateTags: (...args: Parameters<typeof actual.searchCandidateTags>) =>
      searchCandidateTagsMock(...args),
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

vi.mock("../lib/groups-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/groups-api")>(
    "../lib/groups-api"
  );
  return {
    ...actual,
    getGroups: (...args: Parameters<typeof actual.getGroups>) => getGroupsMock(...args),
  };
});

vi.mock("../components/drawers/CandidateDrawer", () => ({
  CandidateDrawer: () => null,
}));

vi.mock("../components/modals/NewCandidateModal", () => ({
  NewCandidateModal: () => null,
}));

vi.mock("../components/modals/NewExamScheduleModal", () => ({
  NewExamScheduleModal: () => null,
}));

vi.mock("../lib/exam-schedules-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/exam-schedules-api")>(
    "../lib/exam-schedules-api"
  );
  return {
    ...actual,
    getExamScheduleOptions: (
      ...args: Parameters<typeof actual.getExamScheduleOptions>
    ) => getExamScheduleOptionsMock(...args),
    createExamSchedule: vi.fn(),
  };
});

vi.mock("../lib/exam-codes-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/exam-codes-api")>(
    "../lib/exam-codes-api"
  );
  return {
    ...actual,
    createExamCode: vi.fn(),
    getExamCodes: (...args: Parameters<typeof actual.getExamCodes>) =>
      getExamCodesMock(...args),
  };
});

vi.mock("../lib/candidate-exam-attempts-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/candidate-exam-attempts-api")>(
    "../lib/candidate-exam-attempts-api"
  );
  return {
    ...actual,
    listCandidateExamAttempts: (
      ...args: Parameters<typeof actual.listCandidateExamAttempts>
    ) => listCandidateExamAttemptsMock(...args),
    createCandidateExamAttempt: (
      ...args: Parameters<typeof actual.createCandidateExamAttempt>
    ) => createCandidateExamAttemptMock(...args),
    updateCandidateExamAttempt: (
      ...args: Parameters<typeof actual.updateCandidateExamAttempt>
    ) => updateCandidateExamAttemptMock(...args),
    chargeCandidateExamAttempt: (
      ...args: Parameters<typeof actual.chargeCandidateExamAttempt>
    ) => chargeCandidateExamAttemptMock(...args),
  };
});

vi.mock("../lib/license-class-fee-matrix-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/license-class-fee-matrix-api")>(
    "../lib/license-class-fee-matrix-api"
  );
  return {
    ...actual,
    getLicenseClassFeeMatrix: (
      ...args: Parameters<typeof actual.getLicenseClassFeeMatrix>
    ) => getLicenseClassFeeMatrixMock(...args),
  };
});

function examScheduleOption(
  date: string,
  overrides: Partial<{
    id: string;
    examType: "e_sinav" | "uygulama";
    time: string;
    capacity: number;
    candidateCount: number;
    licenseClassCounts: { licenseClass: string; count: number }[];
  }> = {}
) {
  return {
    id: overrides.id ?? `${overrides.examType ?? "e_sinav"}-${date}`,
    examType: overrides.examType ?? "e_sinav",
    date,
    time: overrides.time ?? "09:00",
    capacity: overrides.capacity ?? 20,
    candidateCount: overrides.candidateCount ?? 0,
    licenseClassCounts: overrides.licenseClassCounts ?? [],
  };
}

function renderPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/candidates"]}>
      <CandidatesPage />
    </MemoryRouter>
  );
}

function showBulkSelection() {
  fireEvent.click(screen.getByRole("button", { name: "Toplu Seçim" }));
}

function renderESinavPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/exams/e-sinav"]}>
      <ExamESinavPage />
    </MemoryRouter>
  );
}

function renderUygulamaPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/exams/uygulama"]}>
      <ExamUygulamaPage />
    </MemoryRouter>
  );
}

describe("CandidatesPage tabs", () => {
  beforeEach(() => {
    localStorage.clear();
    getCandidatesMock.mockReset();
    getExamScheduleOptionsMock.mockReset();
    getCandidateByIdMock.mockReset();
    updateCandidateMock.mockReset();
    updateCandidateTagMock.mockReset();
    deleteCandidateTagMock.mockReset();
    searchCandidateTagsMock.mockReset();
    assignCandidateGroupMock.mockReset();
    getGroupsMock.mockReset();
    getExamCodesMock.mockReset();
    listCandidateExamAttemptsMock.mockReset();
    createCandidateExamAttemptMock.mockReset();
    updateCandidateExamAttemptMock.mockReset();
    chargeCandidateExamAttemptMock.mockReset();
    getLicenseClassFeeMatrixMock.mockReset();
    searchCandidateTagsMock.mockResolvedValue([]);
    getExamScheduleOptionsMock.mockResolvedValue([]);
    getExamCodesMock.mockResolvedValue([]);
    listCandidateExamAttemptsMock.mockResolvedValue([]);
    createCandidateExamAttemptMock.mockResolvedValue({});
    updateCandidateExamAttemptMock.mockResolvedValue({});
    chargeCandidateExamAttemptMock.mockResolvedValue({});
    getLicenseClassFeeMatrixMock.mockResolvedValue({ year: 2026, vatRate: 20, rows: [] });
    assignCandidateGroupMock.mockResolvedValue({
      id: "assignment-1",
      candidateId: "cand-1",
      groupId: "group-2",
      groupTitle: "2B",
      startDate: "2026-05-05",
      assignedAtUtc: "2026-05-01T10:00:00Z",
      removedAtUtc: null,
      isActive: true,
    });
    getGroupsMock.mockResolvedValue({
      items: [
        {
          id: "group-2",
          title: "2B",
          term: {
            id: "term-2",
            monthDate: "2026-05-01",
            sequence: 1,
            name: null,
          },
          capacity: 20,
          assignedCandidateCount: 5,
          activeCandidateCount: 5,
          licenseClassCounts: [],
          candidatePreview: [],
          startDate: "2026-05-05",
          mebStatus: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
          rowVersion: 1,
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 1,
      totalPages: 1,
    });
    getCandidatesMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalCount: 0,
      totalPages: 1,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to the active tab and sends status='active'", async () => {
    renderPage();

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenCalled();
    });

    const callArgs = getCandidatesMock.mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({ status: "active", page: 1, pageSize: 10 });
    expect(callArgs.candidateTab).toBeUndefined();
  });

  it("renders e-sinav tabs and defaults to the havuz filter", async () => {
    renderESinavPage();

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenCalled();
    });

    const callArgs = getCandidatesMock.mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({ page: 1, pageSize: 10 });
    expect(callArgs.eSinavTab).toBe("havuz");
    expect(callArgs.status).toBe("active");

    expect(screen.getByRole("button", { name: "Havuz" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Başarısız" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Randevulu" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tümü" })).not.toBeInTheDocument();
  });

  it("sends the selected e-sinav tab key to the candidate query", async () => {
    renderESinavPage();

    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Başarısız" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          eSinavTab: "basarisiz",
          page: 1,
          pageSize: 10,
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Randevulu" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          eSinavTab: "randevulu",
          page: 1,
          pageSize: 10,
        })
      );
    });
  });

  it("renders uygulama tabs and defaults to the havuz filter", async () => {
    renderUygulamaPage();

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenCalled();
    });

    const callArgs = getCandidatesMock.mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({ page: 1, pageSize: 10 });
    expect(callArgs.drivingExamTab).toBe("havuz");
    expect(callArgs.status).toBe("active");

    expect(screen.getByRole("button", { name: "Havuz" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Başarısız" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Randevulu" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tümü" })).not.toBeInTheDocument();
  });

  it("sends the selected uygulama tab key to the candidate query", async () => {
    renderUygulamaPage();

    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Başarısız" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          drivingExamTab: "basarisiz",
          page: 1,
          pageSize: 10,
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Randevulu" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          drivingExamTab: "randevulu",
          page: 1,
          pageSize: 10,
        })
      );
    });
  });

  it("filters by driving exam code only while the code sidebar tab is active", async () => {
    getExamCodesMock.mockResolvedValue([
      {
        id: "code-1",
        examType: "uygulama",
        code: "100000001",
        scheduleCount: 2,
        candidateCount: 3,
        createdAtUtc: "2026-05-01T10:00:00Z",
      },
    ]);
    renderUygulamaPage();

    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("tab", { name: "Sınav Kodları" }));

    expect(screen.queryByRole("button", { name: "Havuz" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Başarısız" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Randevulu" })).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /100000001/i }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          drivingExamCode: "100000001",
          page: 1,
          pageSize: 10,
        })
      );
    });
    const codeQuery = getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1]?.[0];
    expect(codeQuery.drivingExamTab).toBeUndefined();
    expect(codeQuery.status).toBeUndefined();

    fireEvent.click(screen.getByRole("tab", { name: "Sınav Tarihleri" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          drivingExamTab: "havuz",
          page: 1,
          pageSize: 10,
        })
      );
    });
    const dateQuery = getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1]?.[0];
    expect(dateQuery.drivingExamCode).toBeUndefined();
  });

  it("loads e-sinav date options without the havuz tab constraint", async () => {
    renderESinavPage();

    await waitFor(() => {
      const params = getExamScheduleOptionsMock.mock.calls[0]?.[0];
      expect(params).toEqual({ examType: "e_sinav" });
    });
  });

  it("loads uygulama date options without the havuz tab constraint", async () => {
    renderUygulamaPage();

    await waitFor(() => {
      const params = getExamScheduleOptionsMock.mock.calls[0]?.[0];
      expect(params).toEqual({ examType: "uygulama" });
    });
  });

  it("shows exam toolbar actions only on exam pages", async () => {
    const examView = renderESinavPage();

    expect(await screen.findByRole("button", { name: "Sınav Tarihi Ekle" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mebbis" })).not.toBeInTheDocument();

    examView.unmount();
    renderPage();

    expect(screen.queryByRole("button", { name: "Sınav Tarihi Ekle" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mebbis" })).not.toBeInTheDocument();
  });

  it("keeps the sidebar free of empty-state copy when no exam schedule exists", async () => {
    renderESinavPage();

    let sidebar: HTMLElement | null = null;
    await waitFor(() => {
      sidebar = document.querySelector(".exam-date-sidebar-list");
      expect(sidebar).not.toBeNull();
    });
    if (!sidebar) {
      throw new Error("exam date sidebar not found");
    }

    expect(within(sidebar).queryByText("Tüm Tarihler")).not.toBeInTheDocument();
    expect(
      within(sidebar).queryByText("Bu görünümde atanmış tarih yok.")
    ).not.toBeInTheDocument();
    expect(within(sidebar).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Sınav Tarihi Ekle",
    ]);
  });

  it("sorts e-sinav dates newest first", async () => {
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-05-20", { candidateCount: 1, time: "08:30" }),
      examScheduleOption("2026-05-22", { candidateCount: 2, time: "10:00" }),
      examScheduleOption("2026-05-25", { candidateCount: 3, time: "11:30" }),
    ]);

    renderESinavPage();

    let sidebar: HTMLElement | null = null;
    await waitFor(() => {
      sidebar = document.querySelector(".exam-date-sidebar-list");
      expect(sidebar).not.toBeNull();
    });
    if (!sidebar) {
      throw new Error("exam date sidebar not found");
    }
    // RQ resolves examScheduleOptions asynchronously; wait until at least one
    // date button shows up before reading the list.
    await within(sidebar).findByText(/25\.05\.2026/);
    const labels = within(sidebar)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim() ?? "")
      .filter((label) => /\d{2}\.\d{2}\.\d{4}/.test(label));

    expect(labels.map((label) => label.slice(0, 10))).toEqual([
      "25.05.2026",
      "22.05.2026",
      "20.05.2026",
    ]);
    expect(labels.every((label) => /\d{2}\.\d{2}\.\d{4}\s*\d{2}:\d{2}/.test(label))).toBe(true);
  });

  it("renders e-sinav date summaries with candidate count only", async () => {
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-05-12", { candidateCount: 3, capacity: 20 }),
    ]);

    renderESinavPage();

    const sidebar = document.querySelector(".exam-date-sidebar-list") as HTMLElement | null;
    expect(sidebar).not.toBeNull();
    if (!sidebar) {
      throw new Error("exam date sidebar not found");
    }

    expect(
      await within(sidebar).findByRole("button", {
        name: /12\.05\.2026\s*09:00\s*3 aday/i,
      })
    ).toBeInTheDocument();
    expect(within(sidebar).queryByText("3/20 dolu")).not.toBeInTheDocument();
  });

  it("renders exam actions above the sidebar dates", async () => {
    renderESinavPage();

    let sidebar: HTMLElement | null = null;
    await waitFor(() => {
      sidebar = document.querySelector(".exam-date-sidebar-list");
      expect(sidebar).not.toBeNull();
    });
    if (!sidebar) {
      throw new Error("exam date sidebar not found");
    }

    const sidebarButtons = within(sidebar)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim() ?? "");

    expect(sidebarButtons[0]).toBe("Sınav Tarihi Ekle");
    expect(sidebarButtons).not.toContain("Mebbis");
  });

  it("moves the divider forward when the day changes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T23:59:58"));

    const view = renderWithProviders(
      <CandidateExamDateSidebar
        onSelect={vi.fn()}
        options={[
          examScheduleOption("2026-05-25", { candidateCount: 3 }),
          examScheduleOption("2026-05-22", { candidateCount: 2 }),
          examScheduleOption("2026-05-20", { candidateCount: 1 }),
        ]}
        title="E-Sınav Tarihi"
      />
    );

    const sidebar = view.container.querySelector(".exam-date-sidebar-list") as HTMLElement;
    const groups = Array.from(sidebar.querySelectorAll(".exam-date-option-group"));

    const firstDivider = within(sidebar).getByTestId("exam-date-divider");
    expect(groups.findIndex((group) => group.contains(firstDivider))).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    const movedDivider = within(sidebar).getByTestId("exam-date-divider");
    expect(groups.findIndex((group) => group.contains(movedDivider))).toBe(1);
  });

  it("renders only one divider when multiple exam schedules share the divider date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00"));

    const view = renderWithProviders(
      <CandidateExamDateSidebar
        onSelect={vi.fn()}
        options={[
          examScheduleOption("2026-06-13", { id: "future", time: "09:00", candidateCount: 2 }),
          examScheduleOption("2026-06-10", { id: "today-late", time: "06:30", candidateCount: 0 }),
          examScheduleOption("2026-06-10", { id: "today-mid", time: "02:00", candidateCount: 0 }),
          examScheduleOption("2026-06-10", { id: "today-early", time: "00:00", candidateCount: 1 }),
          examScheduleOption("2026-06-07", { id: "past", time: "09:00", candidateCount: 1 }),
        ]}
        title="E-Sınav Tarihi"
      />
    );

    const sidebar = view.container.querySelector(".exam-date-sidebar-list") as HTMLElement;
    const dividers = within(sidebar).getAllByTestId("exam-date-divider");
    expect(dividers).toHaveLength(1);

    const groups = Array.from(sidebar.querySelectorAll(".exam-date-option-group"));
    expect(groups.findIndex((group) => group.contains(dividers[0]))).toBe(1);
  });

  it("keeps exam schedule row mutations disabled when management is not allowed", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    renderWithProviders(
      <CandidateExamDateSidebar
        canManageMutations={false}
        onDelete={onDelete}
        onEdit={onEdit}
        onSelect={vi.fn()}
        options={[examScheduleOption("2026-05-25", { candidateCount: 3 })]}
        title="E-Sınav Tarihi"
      />
    );

    const editButton = screen.getByRole("button", { name: /25\.05\.2026 sınav tarihini düzenle/i });
    const deleteButton = screen.getByRole("button", { name: /25\.05\.2026 sınav tarihini sil/i });

    expect(editButton).toBeDisabled();
    expect(editButton).toHaveAttribute("title", "Yetkiniz yok.");
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("title", "Yetkiniz yok.");

    fireEvent.click(editButton);
    fireEvent.click(deleteButton);

    expect(screen.queryByRole("button", { name: /25\.05\.2026 sınav tarihini kaydet/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /Bu tarihi sil/i })).not.toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("edits the exam schedule time without changing the date", async () => {
    const onEdit = vi.fn();

    renderWithProviders(
      <CandidateExamDateSidebar
        onEdit={onEdit}
        onSelect={vi.fn()}
        options={[examScheduleOption("2026-06-13", { time: "09:05", candidateCount: 1 })]}
        title="E-Sınav Tarihi"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /13\.06\.2026 sınav tarihini düzenle/i }));
    fireEvent.click(screen.getByLabelText("Sınav saati"));
    fireEvent.click(screen.getByRole("option", { name: "10:05" }));
    fireEvent.click(screen.getByRole("button", { name: /13\.06\.2026 sınav tarihini kaydet/i }));

    await waitFor(() => {
      expect(onEdit).toHaveBeenCalledWith(
        expect.objectContaining({ date: "2026-06-13", time: "09:05" }),
        "2026-06-13",
        "10:05"
      );
    });
  });

  it("does not pass the hidden time when editing an uygulama date without the time field", async () => {
    const onEdit = vi.fn();

    renderWithProviders(
      <CandidateExamDateSidebar
        onEdit={onEdit}
        onSelect={vi.fn()}
        options={[examScheduleOption("2026-06-13", { examType: "uygulama", time: "09:05", candidateCount: 1 })]}
        showTime={false}
        title="Direksiyon Sınav Tarihi"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /13\.06\.2026 sınav tarihini düzenle/i }));
    fireEvent.change(screen.getByLabelText("Sınav tarihi"), {
      target: { value: "14.06.2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: /13\.06\.2026 sınav tarihini kaydet/i }));

    await waitFor(() => {
      expect(onEdit).toHaveBeenCalledWith(
        expect.objectContaining({ date: "2026-06-13", time: "09:05" }),
        "2026-06-14",
        undefined
      );
    });
  });

  it("filters e-sinav by date without applying a tab filter", async () => {
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-06-12", { candidateCount: 3 }),
    ]);

    renderESinavPage();

    const dateButton = await screen.findByRole("button", { name: /12\.06\.2026/i, pressed: false });
    fireEvent.click(dateButton);

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          eSinavDate: "2026-06-12",
          eSinavScheduleId: "e_sinav-2026-06-12",
          page: 1,
          pageSize: 10,
        })
      );
    });
    const lastCall = getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1];
    expect(lastCall?.[0].eSinavTab).toBeUndefined();
  });

  it("keeps the current e-sinav tab when a past exam date is selected", async () => {
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-05-12", { candidateCount: 3 }),
    ]);

    renderESinavPage();

    const dateButton = await screen.findByRole("button", { name: /12\.05\.2026/i, pressed: false });
    fireEvent.click(dateButton);

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          eSinavDate: "2026-05-12",
          eSinavScheduleId: "e_sinav-2026-05-12",
          page: 1,
          pageSize: 10,
        })
      );
    });
    const lastCall = getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1];
    expect(lastCall?.[0].eSinavTab).toBeUndefined();
    expect(screen.getByRole("button", { name: "Havuz" })).not.toHaveClass("active");
    expect(screen.getByRole("button", { name: "Başarısız" })).not.toHaveClass("active");
    expect(screen.getByRole("button", { name: "Randevulu" })).not.toHaveClass("active");
  });

  it("clears the selected e-sinav date filter when an exam tab is selected", async () => {
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-05-12", { candidateCount: 3 }),
    ]);

    renderESinavPage();

    const dateButton = await screen.findByRole("button", { name: /12\.05\.2026/i, pressed: false });
    fireEvent.click(dateButton);

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          eSinavDate: "2026-05-12",
          eSinavScheduleId: "e_sinav-2026-05-12",
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Başarısız" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          eSinavTab: "basarisiz",
          page: 1,
          pageSize: 10,
        })
      );
    });
    const lastCall = getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1]?.[0];
    expect(lastCall.eSinavDate).toBeUndefined();
    expect(lastCall.eSinavScheduleId).toBeUndefined();
  });

  it("uses the new e-sinav column storage key so old visibility state is ignored", async () => {
    localStorage.setItem("exams.e-sinav.columns.v2", JSON.stringify(["photo", "name"]));

    renderESinavPage();

    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    await screen.findByRole("columnheader", { name: "Hak" });
    expect(screen.queryByRole("columnheader", { name: "Tarih" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Hak" })
    ).toBeInTheDocument();
  });

  it("uses the new uygulama column storage key so old visibility state is ignored", async () => {
    localStorage.setItem("exams.uygulama.columns.v2", JSON.stringify(["photo", "name"]));

    renderUygulamaPage();

    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    await screen.findByRole("columnheader", { name: "Sınav Ücreti Durumu" });
    expect(screen.queryByRole("columnheader", { name: "Tarih" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Hak" })).toBeInTheDocument();
  });

  it("filters the uygulama page by the selected driving exam date", async () => {
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-06-13", {
        examType: "uygulama",
        candidateCount: 2,
      }),
    ]);

    renderUygulamaPage();

    await waitFor(() => {
      expect(getExamScheduleOptionsMock).toHaveBeenCalledWith(
        { examType: "uygulama" },
        expect.any(AbortSignal)
      );
    });

    const sidebar = document.querySelector(".exam-date-sidebar-list") as HTMLElement | null;
    expect(sidebar).not.toBeNull();
    if (!sidebar) {
      throw new Error("exam date sidebar not found");
    }

    const scheduleOptionCallCount = getExamScheduleOptionsMock.mock.calls.length;

    fireEvent.click(
      await within(sidebar).findByRole("button", { name: /13\.06\.2026/i, pressed: false })
    );

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          drivingExamDate: "2026-06-13",
          drivingExamScheduleId: "uygulama-2026-06-13",
          page: 1,
          pageSize: 10,
        })
      );
    });
    const lastCall = getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1];
    expect(lastCall?.[0].drivingExamTab).toBeUndefined();
    expect(getExamScheduleOptionsMock).toHaveBeenCalledTimes(scheduleOptionCallCount);
  });

  it("clears the selected uygulama date filter when an exam tab is selected", async () => {
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-06-13", {
        examType: "uygulama",
        candidateCount: 2,
      }),
    ]);

    renderUygulamaPage();

    const sidebar = document.querySelector(".exam-date-sidebar-list") as HTMLElement | null;
    expect(sidebar).not.toBeNull();
    if (!sidebar) {
      throw new Error("exam date sidebar not found");
    }

    fireEvent.click(
      await within(sidebar).findByRole("button", { name: /13\.06\.2026/i, pressed: false })
    );

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          drivingExamDate: "2026-06-13",
          drivingExamScheduleId: "uygulama-2026-06-13",
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Randevulu" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          drivingExamTab: "randevulu",
          page: 1,
          pageSize: 10,
        })
      );
    });
    const lastCall = getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1]?.[0];
    expect(lastCall.drivingExamDate).toBeUndefined();
    expect(lastCall.drivingExamScheduleId).toBeUndefined();
  });

  it("renders the uygulama sidebar license class beside the date without time", async () => {
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-06-03", {
        examType: "uygulama",
        capacity: 12,
        candidateCount: 4,
        licenseClassCounts: [
          { licenseClass: "B", count: 3 },
          { licenseClass: "B-OTOMATIK", count: 1 },
        ],
      }),
    ]);

    const view = renderUygulamaPage();
    const sidebar = view.container.querySelector(".exam-date-sidebar-list") as HTMLElement | null;
    expect(sidebar).not.toBeNull();
    if (!sidebar) {
      throw new Error("exam date sidebar not found");
    }

    expect(
      await within(sidebar).findByRole("button", {
        name: /03\.06\.2026\s*B\s*-\s*B-O\s*4\/12/i,
      })
    ).toBeInTheDocument();
    expect(within(sidebar).queryByText("09:00")).not.toBeInTheDocument();
    expect(within(sidebar).queryByText(/B\(3\)|A2\(1\)/i)).not.toBeInTheDocument();
  });

  it("does not render aggregate uygulama license summary in the tag row", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalCount: 8,
      totalPages: 1,
    });
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-06-03", {
        examType: "uygulama",
        capacity: 10,
        candidateCount: 2,
        licenseClassCounts: [
          { licenseClass: "B", count: 2 },
        ],
      }),
      examScheduleOption("2026-06-07", {
        examType: "uygulama",
        capacity: 14,
        candidateCount: 2,
        licenseClassCounts: [
          { licenseClass: "B", count: 2 },
        ],
      }),
      examScheduleOption("2026-06-12", {
        examType: "uygulama",
        capacity: 12,
        candidateCount: 2,
        licenseClassCounts: [
          { licenseClass: "B", count: 2 },
        ],
      }),
      examScheduleOption("2026-06-20", {
        examType: "uygulama",
        capacity: 20,
        candidateCount: 2,
        licenseClassCounts: [
          { licenseClass: "B", count: 2 },
        ],
      }),
    ]);

    const view = renderUygulamaPage();
    const tagBar = view.container.querySelector(".tag-filter-bar") as HTMLElement | null;

    expect(tagBar).not.toBeNull();
    if (!tagBar) {
      throw new Error("tag filter bar not found");
    }

    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());
    expect(within(tagBar).queryByLabelText("Ehliyet sınıfı özeti")).not.toBeInTheDocument();
    expect(within(tagBar).queryByText(/\(2\/10\)\s*B\(2\)/i)).not.toBeInTheDocument();
  });

  it("renders the canonical candidate list tabs", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: "Tümü" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ön Kayıt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aktif" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Park" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mezun" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dosya Yakan / Ayrılan" })).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Tüm Adaylar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aktif Dönem" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Atanmamış" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tamamlananlar" })).not.toBeInTheDocument();
  });

  it("clears the status filter when the Tümü tab is selected", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Tümü" }));

    await waitFor(() => {
      const lastCall = getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1]?.[0];
      expect(lastCall.candidateTab).toBeUndefined();
      expect(lastCall.status).toBeUndefined();
      expect(lastCall.page).toBe(1);
      expect(lastCall.pageSize).toBe(10);
    });
  });

  it("lets the user show and hide the status column from the picker", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());
    expect(screen.getByRole("columnheader", { name: /^Durum$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Sütunlar"));
    const picker = document.querySelector(".column-picker-menu") as HTMLElement | null;
    expect(picker).not.toBeNull();
    if (!picker) {
      throw new Error("column picker menu not found");
    }
    fireEvent.click(within(picker).getByLabelText("Durum"));

    await waitFor(() => {
      expect(screen.queryByRole("columnheader", { name: /^Durum$/i })).not.toBeInTheDocument();
    });

    fireEvent.click(within(picker).getByLabelText("Durum"));

    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: /^Durum$/i })).toBeInTheDocument();
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
        })
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

  it("does not send the main search query until the second character", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());
    expect(getCandidatesMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText("Aday ara... (ad, soyad, TC)"), {
      target: { value: "A" },
    });

    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(getCandidatesMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText("Aday ara... (ad, soyad, TC)"), {
      target: { value: "Ay" },
    });

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenCalledTimes(2);
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: "Ay",
          page: 1,
        })
      );
    });
  });

  it("keeps optional candidate columns hidden by default but lists them in the picker", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(screen.queryByText("Telefon")).not.toBeInTheDocument();
    expect(screen.queryByText("Kayıt Tarihi")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sütunlar" }));

    expect(screen.getByText("Telefon")).toBeInTheDocument();
    expect(screen.getByText("Kayıt Tarihi")).toBeInTheDocument();
    expect(screen.getByText("Güncelleme Tarihi")).toBeInTheDocument();
    const picker = document.querySelector(".column-picker-menu") as HTMLElement | null;
    expect(picker).not.toBeNull();
    if (!picker) {
      throw new Error("column picker menu not found");
    }
    expect(within(picker).getByText("Ehliyet Tipi")).toBeInTheDocument();
  });

  it("renders exam progress columns on the main candidates page", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(screen.getByRole("columnheader", { name: "Sınav Hakkı" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Sınav Durumu" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    const picker = document.querySelector(".column-picker-menu") as HTMLElement | null;
    expect(picker).not.toBeNull();
    if (!picker) {
      throw new Error("column picker menu not found");
    }

    expect(within(picker).queryByText("E-Sınav Tarihi")).not.toBeInTheDocument();
    expect(within(picker).queryByText("Direksiyon Tarihi")).not.toBeInTheDocument();
    expect(within(picker).queryByText("Direksiyon Hakkı")).not.toBeInTheDocument();
  });

  it("renders unified exam attempt and status values on the active period tab", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "20000000114",
          motherName: null,
          fatherName: null,
          referenceName: null,
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamDate: "2026-05-10",
          mebExamResult: null,
          eSinavAttemptCount: 2,
          drivingExamDate: null,
          drivingExamAttemptCount: 1,
          totalFee: 0,
          totalPaid: 0,
          totalDebt: 0,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
          rowVersion: 1,
        },
        {
          id: "cand-2",
          firstName: "Mehmet",
          lastName: "Kaya",
          nationalId: "12345678902",
          motherName: null,
          fatherName: null,
          referenceName: null,
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          educationPlan: { requiresTheoryExam: false },
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamDate: null,
          mebExamResult: null,
          eSinavAttemptCount: 1,
          drivingExamDate: null,
          drivingExamAttemptCount: 1,
          totalFee: 0,
          totalPaid: 0,
          totalDebt: 0,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
          rowVersion: 1,
        },
        {
          id: "cand-3",
          firstName: "Zeynep",
          lastName: "Acar",
          nationalId: "12345678903",
          motherName: null,
          fatherName: null,
          referenceName: null,
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "graduated",
          currentGroup: null,
          documentSummary: null,
          mebExamDate: null,
          mebExamResult: "Başarılı",
          eSinavAttemptCount: 1,
          drivingExamDate: null,
          drivingExamAttemptCount: 3,
          totalFee: 0,
          totalPaid: 0,
          totalDebt: 0,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
          rowVersion: 1,
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 3,
      totalPages: 1,
    });

    renderPage();
    await screen.findByText("Ayse Demir");

    expect(await screen.findByText("E-sınav 2/4")).toBeInTheDocument();
    expect(screen.getByText("E-sınav randevulu")).toBeInTheDocument();
    expect(screen.getByText("Direksiyon 1/4")).toBeInTheDocument();
    expect(screen.getByText("Direksiyon havuz")).toBeInTheDocument();
    expect(screen.getByText("Direksiyon 3/4")).toBeInTheDocument();
    expect(screen.getByText("Direksiyon başarılı")).toBeInTheDocument();
  });

  it("keeps e-sinav date hidden and attempt visible but out of the picker", async () => {
    renderESinavPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    await screen.findByRole("columnheader", { name: "Hak" });
    expect(screen.queryByRole("columnheader", { name: "Tarih" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Hak" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    const picker = document.querySelector(".column-picker-menu") as HTMLElement | null;
    expect(picker).not.toBeNull();
    if (!picker) {
      throw new Error("column picker menu not found");
    }

    expect(within(picker).queryByText(/^Tarih$/)).not.toBeInTheDocument();
    expect(within(picker).queryByText(/^Hak$/)).not.toBeInTheDocument();
  });

  it("keeps uygulama locked columns visible and out of the picker", async () => {
    renderUygulamaPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    await screen.findByRole("columnheader", { name: "Sınav Ücreti Durumu" });
    expect(screen.queryByRole("columnheader", { name: "Tarih" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Hak" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Sınav Durumu" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Sınav Sonucu" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    const picker = document.querySelector(".column-picker-menu") as HTMLElement | null;
    expect(picker).not.toBeNull();
    if (!picker) {
      throw new Error("column picker menu not found");
    }

    expect(within(picker).queryByText(/^Tarih$/)).not.toBeInTheDocument();
    expect(within(picker).queryByText(/^Hak$/)).not.toBeInTheDocument();
    expect(within(picker).queryByText(/^Sınav Durumu$/)).not.toBeInTheDocument();
    expect(within(picker).queryByText(/^Sınav Sonucu$/)).not.toBeInTheDocument();
    expect(within(picker).queryByText("Sınav Ücreti Durumu")).not.toBeInTheDocument();
  });

  it("shows driving exam status columns after attempt count on the uygulama failed tab", async () => {
    renderUygulamaPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Başarısız" }));

    await screen.findByRole("columnheader", { name: "Son Sınav Tarihi" });
    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent?.trim());
    expect(headers).toEqual(
      expect.arrayContaining([
        "Hak",
        "Sınav Durumu",
        "Sınav Sonucu",
        "Sınav Ücreti Durumu",
        "Son Sınav Tarihi",
        "Son Sınav Kodu",
      ])
    );
    expect(headers.indexOf("Sınav Durumu")).toBe(headers.indexOf("Hak") + 1);
    expect(headers.indexOf("Sınav Sonucu")).toBe(headers.indexOf("Sınav Durumu") + 1);
    expect(headers.indexOf("Sınav Ücreti Durumu")).toBe(headers.indexOf("Sınav Sonucu") + 1);
    expect(headers.indexOf("Son Sınav Tarihi")).toBe(headers.indexOf("Sınav Ücreti Durumu") + 1);
    expect(headers.indexOf("Son Sınav Kodu")).toBe(headers.indexOf("Son Sınav Tarihi") + 1);
  });

  it("updates driving exam attendance status from the exam list and clears result when not attended", async () => {
    const candidate = {
      id: "cand-1",
      firstName: "Ayse",
      lastName: "Demir",
      nationalId: "20000000114",
      phoneNumber: null,
      email: null,
      birthDate: null,
      gender: null,
      licenseClass: "B",
      existingLicenseType: null,
      existingLicenseIssuedAt: null,
      existingLicenseNumber: null,
      existingLicenseIssuedProvince: null,
      existingLicensePre2016: false,
      status: "active",
      mebExamResult: "passed",
      drivingExamDate: "2026-06-12",
      drivingExamAttemptId: "attempt-1",
      drivingExamScheduleId: "schedule-1",
      drivingExamScheduledAt: "2026-06-12T06:00:00.000Z",
      drivingExamAttendanceStatus: "attended",
      drivingExamResultStatus: "passed",
      drivingExamAttemptCount: 1,
      drivingExamFee: 1500,
      drivingExamFeeStatus: "pending",
      drivingExamAttemptRowVersion: 7,
      currentGroup: null,
      documentSummary: null,
      createdAtUtc: "2026-04-01T10:00:00Z",
      updatedAtUtc: "2026-04-02T10:00:00Z",
    };

    getCandidatesMock.mockResolvedValue({
      items: [candidate],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });
    listCandidateExamAttemptsMock.mockResolvedValue([{
      id: "attempt-1",
      candidateId: "cand-1",
      examType: "practice",
      scheduledAt: "2026-06-12T06:00:00.000Z",
      attemptNumber: 1,
      score: null,
      expiresAt: null,
      examScheduleId: "schedule-1",
      examCode: null,
      vehicleId: null,
      vehiclePlate: null,
      instructorId: null,
      instructorFullName: null,
      examAttendanceStatus: "attended",
      examResultStatus: "passed",
      fee: 1500,
      feeStatus: "paid",
      paidAt: "2026-06-08T08:00:00.000Z",
      accountingMovementId: "movement-1",
      createdAt: "2026-06-07T08:00:00.000Z",
      rowVersion: 9,
    }]);
    updateCandidateExamAttemptMock.mockResolvedValue({
      id: "attempt-1",
      candidateId: "cand-1",
      examType: "practice",
      scheduledAt: "2026-06-12T06:00:00.000Z",
      attemptNumber: 1,
      score: null,
      expiresAt: null,
      examScheduleId: "schedule-1",
      examCode: null,
      vehicleId: null,
      vehiclePlate: null,
      instructorId: null,
      instructorFullName: null,
      examAttendanceStatus: "absent",
      examResultStatus: null,
      fee: 1500,
      feeStatus: "pending",
      paidAt: null,
      accountingMovementId: null,
      createdAt: "2026-06-07T08:00:00.000Z",
      rowVersion: 8,
    });

    renderUygulamaPage();

    fireEvent.click(await screen.findByRole("button", { name: "Girdi" }));
    fireEvent.change(screen.getByLabelText("Sınav durumu"), {
      target: { value: "absent" },
    });

    await waitFor(() => {
      expect(updateCandidateExamAttemptMock).toHaveBeenCalledWith(
        "cand-1",
        "attempt-1",
        expect.objectContaining({
          examAttendanceStatus: "absent",
          examResultStatus: null,
          feeStatus: "paid",
          rowVersion: 9,
        })
      );
    });
    expect(await screen.findByRole("button", { name: "Girmedi" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Başarılı" })).not.toBeInTheDocument();
  });

  it("updates driving exam result status from the exam list", async () => {
    const candidate = {
      id: "cand-1",
      firstName: "Ayse",
      lastName: "Demir",
      nationalId: "20000000114",
      phoneNumber: null,
      email: null,
      birthDate: null,
      gender: null,
      licenseClass: "B",
      existingLicenseType: null,
      existingLicenseIssuedAt: null,
      existingLicenseNumber: null,
      existingLicenseIssuedProvince: null,
      existingLicensePre2016: false,
      status: "active",
      mebExamResult: "passed",
      drivingExamDate: "2026-06-12",
      drivingExamAttemptId: "attempt-1",
      drivingExamScheduleId: "schedule-1",
      drivingExamScheduledAt: "2026-06-12T06:00:00.000Z",
      drivingExamAttendanceStatus: "attended",
      drivingExamResultStatus: "passed",
      drivingExamAttemptCount: 1,
      drivingExamFee: 1500,
      drivingExamFeeStatus: "pending",
      drivingExamAttemptRowVersion: 7,
      currentGroup: null,
      documentSummary: null,
      createdAtUtc: "2026-04-01T10:00:00Z",
      updatedAtUtc: "2026-04-02T10:00:00Z",
    };

    getCandidatesMock.mockResolvedValue({
      items: [candidate],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });
    listCandidateExamAttemptsMock.mockResolvedValue([{
      id: "attempt-1",
      candidateId: "cand-1",
      examType: "practice",
      scheduledAt: "2026-06-12T06:00:00.000Z",
      attemptNumber: 1,
      score: null,
      expiresAt: null,
      examScheduleId: "schedule-1",
      examCode: null,
      vehicleId: null,
      vehiclePlate: null,
      instructorId: null,
      instructorFullName: null,
      examAttendanceStatus: "attended",
      examResultStatus: "passed",
      fee: 1500,
      feeStatus: "paid",
      paidAt: "2026-06-08T08:00:00.000Z",
      accountingMovementId: "movement-1",
      createdAt: "2026-06-07T08:00:00.000Z",
      rowVersion: 9,
    }]);
    updateCandidateExamAttemptMock.mockResolvedValue({
      id: "attempt-1",
      candidateId: "cand-1",
      examType: "practice",
      scheduledAt: "2026-06-12T06:00:00.000Z",
      attemptNumber: 1,
      score: null,
      expiresAt: null,
      examScheduleId: "schedule-1",
      examCode: null,
      vehicleId: null,
      vehiclePlate: null,
      instructorId: null,
      instructorFullName: null,
      examAttendanceStatus: "attended",
      examResultStatus: "failed",
      fee: 1500,
      feeStatus: "pending",
      paidAt: null,
      accountingMovementId: null,
      createdAt: "2026-06-07T08:00:00.000Z",
      rowVersion: 8,
    });

    renderUygulamaPage();

    fireEvent.click(await screen.findByRole("button", { name: "Başarılı" }));
    fireEvent.change(screen.getByLabelText("Sınav sonucu"), {
      target: { value: "failed" },
    });

    await waitFor(() => {
      expect(updateCandidateExamAttemptMock).toHaveBeenCalledWith(
        "cand-1",
        "attempt-1",
        expect.objectContaining({
          examAttendanceStatus: "attended",
          examResultStatus: "failed",
          feeStatus: "paid",
          rowVersion: 9,
        })
      );
    });
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Başarısız" }).length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders the group column with the term month in the same cell", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "20000000114",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          status: "active",
          currentGroup: {
            groupId: "group-1",
            title: "1B",
            startDate: "2026-04-02",
            term: {
              id: "term-1",
              monthDate: "2026-04-01",
              sequence: 1,
              name: null,
            },
            assignedAtUtc: "2026-04-01T10:00:00Z",
          },
          documentSummary: {
            completedCount: 1,
            missingCount: 0,
            totalRequiredCount: 1,
          },
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });

    renderPage();

    expect(await screen.findByText("NİSAN 2026 - 1B")).toBeInTheDocument();
  });

  it("renders the e-sinav group column as a period column", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "20000000114",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          status: "active",
          currentGroup: {
            groupId: "group-1",
            title: "1B",
            startDate: "2026-04-02",
            term: {
              id: "term-2",
              monthDate: "2026-04-01",
              sequence: 2,
              name: null,
            },
            assignedAtUtc: "2026-04-01T10:00:00Z",
          },
          documentSummary: {
            completedCount: 1,
            missingCount: 0,
            totalRequiredCount: 1,
          },
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });

    renderESinavPage();

    expect(await screen.findByRole("columnheader", { name: "Dönem" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Grup" })).not.toBeInTheDocument();
    expect(await screen.findByText("NİSAN 2026 / 2")).toBeInTheDocument();
    expect(screen.queryByText("NİSAN 2026 - 1B")).not.toBeInTheDocument();
  });

  it("updates e-sinav score from the exam list", async () => {
    const candidate = {
      id: "cand-1",
      firstName: "Ayse",
      lastName: "Demir",
      nationalId: "20000000114",
      phoneNumber: null,
      email: null,
      birthDate: null,
      gender: null,
      licenseClass: "B",
      existingLicenseType: null,
      existingLicenseIssuedAt: null,
      existingLicenseNumber: null,
      existingLicenseIssuedProvince: null,
      existingLicensePre2016: false,
      status: "active",
      mebExamDate: "2026-06-12",
      mebExamResult: "failed",
      eSinavAttemptCount: 1,
      eSinavAttemptId: "attempt-1",
      eSinavScore: 65,
      currentGroup: null,
      documentSummary: {
        completedCount: 1,
        missingCount: 0,
        totalRequiredCount: 1,
      },
      createdAtUtc: "2026-04-01T10:00:00Z",
      updatedAtUtc: "2026-04-02T10:00:00Z",
    };
    const attempt = {
      id: "attempt-1",
      candidateId: "cand-1",
      examType: "theory" as const,
      scheduledAt: "2026-06-12T06:00:00.000Z",
      attemptNumber: 1,
      score: 65,
      expiresAt: null,
      examScheduleId: "e_sinav-2026-06-12",
      examCode: null,
      vehicleId: null,
      vehiclePlate: null,
      instructorId: null,
      instructorFullName: null,
      examAttendanceStatus: null,
      examResultStatus: null,
      fee: 900,
      feeStatus: "pending" as const,
      paidAt: null,
      accountingMovementId: null,
      createdAt: "2026-06-07T08:00:00.000Z",
      rowVersion: 7,
    };

    getCandidatesMock
      .mockResolvedValueOnce({
        items: [candidate],
        page: 1,
        pageSize: 10,
        totalCount: 1,
        totalPages: 1,
      })
      .mockResolvedValue({
        items: [candidate],
        page: 1,
        pageSize: 10,
        totalCount: 1,
        totalPages: 1,
      });
    listCandidateExamAttemptsMock.mockResolvedValue([attempt]);
    updateCandidateExamAttemptMock.mockResolvedValue({ ...attempt, score: 72, rowVersion: 8 });
    updateCandidateMock.mockResolvedValue({
      ...candidate,
      mebExamResult: "passed",
      eSinavScore: 72,
      updatedAtUtc: "2026-04-03T10:00:00Z",
    });

    renderESinavPage();

    await screen.findByRole("columnheader", { name: "Puan" });
    expect(await screen.findByRole("button", { name: /65\s*Kaldı/ })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /65\s*Kaldı/ }));
    const input = document.querySelector(".candidate-exam-score-input") as HTMLInputElement | null;
    expect(input).not.toBeNull();
    if (!input) {
      throw new Error("score input not found");
    }
    fireEvent.change(input, { target: { value: "72" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(updateCandidateExamAttemptMock).toHaveBeenCalledWith(
        "cand-1",
        "attempt-1",
        expect.objectContaining({
          score: 72,
          rowVersion: 7,
        })
      );
    });
    expect(updateCandidateMock).toHaveBeenCalledWith(
      "cand-1",
      expect.objectContaining({
        mebExamDate: "2026-06-12",
        mebExamResult: "passed",
        eSinavAttemptCount: 1,
      })
    );
    expect(await screen.findByRole("button", { name: /72\s*Geçti/ })).toBeInTheDocument();
  });

  it("keeps the edited historical e-sinav score visible while candidate summary follows latest attempt", async () => {
    const candidate = {
      id: "cand-1",
      firstName: "Ayse",
      lastName: "Demir",
      nationalId: "20000000114",
      phoneNumber: null,
      email: null,
      birthDate: null,
      gender: null,
      licenseClass: "B",
      existingLicenseType: null,
      existingLicenseIssuedAt: null,
      existingLicenseNumber: null,
      existingLicenseIssuedProvince: null,
      existingLicensePre2016: false,
      status: "active",
      mebExamDate: "2026-05-10",
      mebExamResult: "failed",
      eSinavAttemptCount: 1,
      eSinavAttemptId: "attempt-old",
      eSinavScore: 55,
      currentGroup: null,
      documentSummary: {
        completedCount: 1,
        missingCount: 0,
        totalRequiredCount: 1,
      },
      createdAtUtc: "2026-04-01T10:00:00Z",
      updatedAtUtc: "2026-04-02T10:00:00Z",
    };
    const oldAttempt = {
      id: "attempt-old",
      candidateId: "cand-1",
      examType: "theory" as const,
      scheduledAt: "2026-05-10T06:00:00.000Z",
      attemptNumber: 1,
      score: 55,
      expiresAt: null,
      examScheduleId: "e_sinav-2026-05-10",
      examCode: null,
      vehicleId: null,
      vehiclePlate: null,
      instructorId: null,
      instructorFullName: null,
      examAttendanceStatus: null,
      examResultStatus: null,
      fee: 900,
      feeStatus: "pending" as const,
      paidAt: null,
      accountingMovementId: null,
      createdAt: "2026-05-07T08:00:00.000Z",
      rowVersion: 4,
    };
    const latestAttempt = {
      ...oldAttempt,
      id: "attempt-latest",
      scheduledAt: "2026-05-20T06:00:00.000Z",
      attemptNumber: 2,
      score: 80,
      examScheduleId: "e_sinav-2026-05-20",
      rowVersion: 5,
    };

    getCandidatesMock
      .mockResolvedValueOnce({
        items: [candidate],
        page: 1,
        pageSize: 10,
        totalCount: 1,
        totalPages: 1,
      })
      .mockResolvedValue({
        items: [{ ...candidate, eSinavScore: 60 }],
        page: 1,
        pageSize: 10,
        totalCount: 1,
        totalPages: 1,
      });
    listCandidateExamAttemptsMock.mockResolvedValue([oldAttempt, latestAttempt]);
    updateCandidateExamAttemptMock.mockResolvedValue({ ...oldAttempt, score: 60, rowVersion: 6 });
    updateCandidateMock.mockResolvedValue({
      ...candidate,
      mebExamDate: "2026-05-20",
      mebExamResult: "passed",
      eSinavAttemptCount: 2,
      updatedAtUtc: "2026-04-03T10:00:00Z",
    });

    renderESinavPage();

    fireEvent.click(await screen.findByRole("button", { name: /55\s*Kaldı/ }));
    const input = document.querySelector(".candidate-exam-score-input") as HTMLInputElement | null;
    expect(input).not.toBeNull();
    if (!input) {
      throw new Error("score input not found");
    }
    fireEvent.change(input, { target: { value: "60" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(updateCandidateExamAttemptMock).toHaveBeenCalledWith(
        "cand-1",
        "attempt-old",
        expect.objectContaining({
          score: 60,
          rowVersion: 4,
        })
      );
    });
    expect(updateCandidateMock).toHaveBeenCalledWith(
      "cand-1",
      expect.objectContaining({
        mebExamDate: "2026-05-20",
        mebExamResult: "passed",
        eSinavAttemptCount: 2,
      })
    );
    expect(await screen.findByRole("button", { name: /60\s*Kaldı/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /80\s*Geçti/ })).not.toBeInTheDocument();
    expect(screen.getByText("1/4")).toBeInTheDocument();
    expect(screen.queryByText("2/4")).not.toBeInTheDocument();
  });

  it("clears e-sinav score from the exam list", async () => {
    const candidate = {
      id: "cand-1",
      firstName: "Ayse",
      lastName: "Demir",
      nationalId: "20000000114",
      phoneNumber: null,
      email: null,
      birthDate: null,
      gender: null,
      licenseClass: "B",
      existingLicenseType: null,
      existingLicenseIssuedAt: null,
      existingLicenseNumber: null,
      existingLicenseIssuedProvince: null,
      existingLicensePre2016: false,
      status: "active",
      mebExamDate: "2026-06-12",
      mebExamResult: "passed",
      eSinavAttemptCount: 1,
      eSinavAttemptId: "attempt-1",
      eSinavScore: 72,
      currentGroup: null,
      documentSummary: {
        completedCount: 1,
        missingCount: 0,
        totalRequiredCount: 1,
      },
      createdAtUtc: "2026-04-01T10:00:00Z",
      updatedAtUtc: "2026-04-02T10:00:00Z",
    };
    const attempt = {
      id: "attempt-1",
      candidateId: "cand-1",
      examType: "theory" as const,
      scheduledAt: "2026-06-12T06:00:00.000Z",
      attemptNumber: 1,
      score: 72,
      expiresAt: null,
      examScheduleId: "e_sinav-2026-06-12",
      examCode: null,
      vehicleId: null,
      vehiclePlate: null,
      instructorId: null,
      instructorFullName: null,
      examAttendanceStatus: null,
      examResultStatus: null,
      fee: 900,
      feeStatus: "pending" as const,
      paidAt: null,
      accountingMovementId: null,
      createdAt: "2026-06-07T08:00:00.000Z",
      rowVersion: 7,
    };

    getCandidatesMock
      .mockResolvedValueOnce({
        items: [candidate],
        page: 1,
        pageSize: 10,
        totalCount: 1,
        totalPages: 1,
      })
      .mockResolvedValue({
        items: [{ ...candidate, mebExamResult: null, eSinavScore: null }],
        page: 1,
        pageSize: 10,
        totalCount: 1,
        totalPages: 1,
      });
    listCandidateExamAttemptsMock.mockResolvedValue([attempt]);
    updateCandidateExamAttemptMock.mockResolvedValue({ ...attempt, score: null, rowVersion: 8 });
    updateCandidateMock.mockResolvedValue({
      ...candidate,
      mebExamResult: null,
      eSinavScore: null,
      updatedAtUtc: "2026-04-03T10:00:00Z",
    });

    renderESinavPage();

    fireEvent.click(await screen.findByRole("button", { name: /72\s*Geçti/ }));
    const input = document.querySelector(".candidate-exam-score-input") as HTMLInputElement | null;
    expect(input).not.toBeNull();
    if (!input) {
      throw new Error("score input not found");
    }
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(updateCandidateExamAttemptMock).toHaveBeenCalledWith(
        "cand-1",
        "attempt-1",
        expect.objectContaining({
          score: null,
          rowVersion: 7,
        })
      );
    });
    expect(updateCandidateMock).toHaveBeenCalledWith(
      "cand-1",
      expect.objectContaining({
        mebExamDate: "2026-06-12",
        mebExamResult: null,
        eSinavAttemptCount: 1,
      })
    );
    expect(await screen.findByRole("button", { name: "—" })).toBeInTheDocument();
    expect(screen.queryByText("Geçti")).not.toBeInTheDocument();
    expect(screen.queryByText("Kaldı")).not.toBeInTheDocument();
  });

  it("renders biometric photo when present and initials fallback otherwise", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "20000000114",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: {
            completedCount: 1,
            missingCount: 0,
            totalRequiredCount: 1,
          },
          photo: {
            documentId: "doc-1",
            kind: "biometric_photo",
          },
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
        {
          id: "cand-2",
          firstName: "Mehmet",
          lastName: "Kaya",
          nationalId: "12345678902",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: {
            completedCount: 0,
            missingCount: 1,
            totalRequiredCount: 1,
          },
          photo: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 2,
      totalPages: 1,
    });

    renderPage();

    const image = await screen.findByRole("img", { name: "Ayse Demir" });
    expect(image).toHaveAttribute(
      "src",
      "http://127.0.0.1:5080/api/candidates/cand-1/documents/doc-1/download"
    );
    expect(screen.getByText("MK")).toBeInTheDocument();
  });

  it("renders meb sync status labels instead of leaving the field blank", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "20000000114",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          mebSyncStatus: "not_synced",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
        {
          id: "cand-2",
          firstName: "Mehmet",
          lastName: "Kaya",
          nationalId: "12345678902",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          mebSyncStatus: "synced",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: "passed",
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 2,
      totalPages: 1,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    fireEvent.click(await screen.findByLabelText("Mebbis"));

    expect(await screen.findByText("Beklemede")).toBeInTheDocument();
    expect(screen.getByText("Senkronize")).toBeInTheDocument();
  });

  it("keeps bulk selection hidden until toggled from the toolbar", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "20000000114",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });

    renderPage();

    await screen.findByText("Ayse Demir");

    expect(screen.getByRole("button", { name: "Toplu Seçim" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yeni Aday" })).toBeInTheDocument();
    expect(screen.queryByText("0 seçili")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Etiket Ekle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Durum Değiştir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dışa Aktar" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Toplu durum seç")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Bu sayfadaki tüm adayları seç" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Ayse Demir seç" })).not.toBeInTheDocument();

    showBulkSelection();

    expect(
      screen.getByRole("checkbox", { name: "Bu sayfadaki tüm adayları seç" })
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Ayse Demir seç" })).toBeInTheDocument();
  });

  it("keeps export actions visible without bulk selection mode", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "20000000114",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });

    renderPage();

    await screen.findByText("Ayse Demir");
    expect(screen.getByRole("button", { name: "Dışa Aktar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "CSV İndir" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dışa Aktar" }));

    expect(await screen.findByText("Önce en az bir aday seç")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "CSV İndir" })).not.toBeInTheDocument();

    showBulkSelection();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Dışa Aktar" }));

    expect(screen.getByRole("button", { name: "Yeni Aday" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CSV İndir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kapat" })).toBeInTheDocument();
  });

  it("shows a toast when a bulk action is clicked without selecting a candidate", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "20000000114",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });

    renderPage();

    await screen.findByText("Ayse Demir");
    fireEvent.click(screen.getByRole("button", { name: "Durum Değiştir" }));

    expect(await screen.findByText("Önce en az bir aday seç")).toBeInTheDocument();
    expect(screen.queryByLabelText("Toplu durum seç")).not.toBeInTheDocument();
  });

  it("opens the bulk status dropdown after switching to status mode", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "20000000114",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });

    renderPage();

    await screen.findByText("Ayse Demir");
    showBulkSelection();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Durum Değiştir" }));
    fireEvent.click(screen.getByRole("button", { name: "Durum seç" }));

    expect(await screen.findByRole("option", { name: "Park" })).toBeInTheDocument();
  });

  it("cancels a bulk action and shows the bulk action buttons again", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "20000000114",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });

    renderPage();

    await screen.findByText("Ayse Demir");
    showBulkSelection();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Durum Değiştir" }));

    expect(screen.getByRole("button", { name: "Uygula" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "İptal" }));

    expect(screen.getByRole("button", { name: "Durum Değiştir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Etiket Ekle" })).toBeInTheDocument();
  });

  it("selects visible rows with the bulk selection header checkbox", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "20000000114",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
        {
          id: "cand-2",
          firstName: "Mehmet",
          lastName: "Kaya",
          nationalId: "12345678902",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: "passed",
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 2,
      totalPages: 1,
    });

    renderPage();

    await screen.findByText("Ayse Demir");
    showBulkSelection();

    const selectAll = screen.getByRole("checkbox", {
      name: "Bu sayfadaki tüm adayları seç",
    });

    fireEvent.click(selectAll);

    expect(screen.getByRole("checkbox", { name: "Ayse Demir seç" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Mehmet Kaya seç" })).toBeChecked();
  });

  it("applies bulk status update to selected candidates", async () => {
    const candidates = [
      {
        id: "cand-1",
        firstName: "Ayse",
        lastName: "Demir",
        nationalId: "20000000114",
        phoneNumber: null,
        email: null,
        birthDate: null,
        gender: null,
        licenseClass: "B",
        existingLicenseType: null,
        existingLicenseIssuedAt: null,
        existingLicenseNumber: null,
        existingLicenseIssuedProvince: null,
        existingLicensePre2016: false,
        status: "active",
        currentGroup: null,
        documentSummary: null,
        mebExamResult: null,
        createdAtUtc: "2026-04-01T10:00:00Z",
        updatedAtUtc: "2026-04-02T10:00:00Z",
      },
    ];

    getCandidatesMock.mockResolvedValue({
      items: candidates,
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });
    updateCandidateMock.mockResolvedValue(candidates[0]);

    renderPage();

    await screen.findByText("Ayse Demir");
    showBulkSelection();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Durum Değiştir" }));
    fireEvent.change(screen.getByLabelText("Toplu durum seç"), {
      target: { value: "parked" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uygula" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "cand-1",
        expect.objectContaining({
          status: "parked",
        })
      );
    });
  });

  it("assigns selected candidates to a group in bulk", async () => {
    const candidates = [
      {
        id: "cand-1",
        firstName: "Ayse",
        lastName: "Demir",
        nationalId: "20000000114",
        phoneNumber: null,
        email: null,
        birthDate: null,
        gender: null,
        licenseClass: "B",
        existingLicenseType: null,
        existingLicenseIssuedAt: null,
        existingLicenseNumber: null,
        existingLicenseIssuedProvince: null,
        existingLicensePre2016: false,
        status: "active",
        currentGroup: null,
        documentSummary: null,
        mebExamResult: null,
        createdAtUtc: "2026-04-01T10:00:00Z",
        updatedAtUtc: "2026-04-02T10:00:00Z",
      },
      {
        id: "cand-2",
        firstName: "Mehmet",
        lastName: "Kaya",
        nationalId: "12345678902",
        phoneNumber: null,
        email: null,
        birthDate: null,
        gender: null,
        licenseClass: "B",
        existingLicenseType: null,
        existingLicenseIssuedAt: null,
        existingLicenseNumber: null,
        existingLicenseIssuedProvince: null,
        existingLicensePre2016: false,
        status: "active",
        currentGroup: {
          groupId: "old-group",
          title: "1A",
          startDate: "2026-04-10",
          term: {
            id: "term-1",
            monthDate: "2026-04-01",
            sequence: 1,
            name: null,
          },
          assignedAtUtc: "2026-04-01T10:00:00Z",
        },
        documentSummary: null,
        mebExamResult: null,
        createdAtUtc: "2026-04-01T10:00:00Z",
        updatedAtUtc: "2026-04-02T10:00:00Z",
      },
    ];

    getCandidatesMock.mockResolvedValue({
      items: candidates,
      page: 1,
      pageSize: 10,
      totalCount: 2,
      totalPages: 1,
    });

    renderPage();

    await screen.findByText("Ayse Demir");
    showBulkSelection();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Mehmet Kaya seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Gruba Aktar" }));

    await waitFor(() => {
      expect(getGroupsMock).toHaveBeenCalledWith({ pageSize: 100 });
    });

    fireEvent.change(screen.getByLabelText("Toplu grup seç"), {
      target: { value: "group-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uygula" }));

    await waitFor(() => {
      expect(assignCandidateGroupMock).toHaveBeenCalledWith("cand-1", "group-2");
      expect(assignCandidateGroupMock).toHaveBeenCalledWith("cand-2", "group-2");
    });
  });

  it("applies bulk tag update to selected candidates without dropping existing tags", async () => {
    const candidates = [
      {
        id: "cand-1",
        firstName: "Ayse",
        lastName: "Demir",
        nationalId: "20000000114",
        phoneNumber: null,
        email: null,
        birthDate: null,
        gender: null,
        licenseClass: "B",
        existingLicenseType: null,
        existingLicenseIssuedAt: null,
        existingLicenseNumber: null,
        existingLicenseIssuedProvince: null,
        existingLicensePre2016: false,
        status: "active",
        currentGroup: null,
        documentSummary: null,
        mebExamResult: null,
        tags: [{ id: "tag-1", name: "Referans" }],
        createdAtUtc: "2026-04-01T10:00:00Z",
        updatedAtUtc: "2026-04-02T10:00:00Z",
      },
    ];

    getCandidatesMock.mockResolvedValue({
      items: candidates,
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });
    updateCandidateMock.mockResolvedValue(candidates[0]);

    renderPage();

    await screen.findByText("Ayse Demir");
    showBulkSelection();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Etiket Ekle" }));

    const bulkTagsInput = screen.getByLabelText("Toplu etiket seç");
    fireEvent.change(bulkTagsInput, { target: { value: "VIP" } });
    fireEvent.keyDown(bulkTagsInput, { key: ",", code: "Comma" });
    fireEvent.click(screen.getByRole("button", { name: "Uygula" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "cand-1",
        expect.objectContaining({
          tags: ["Referans", "VIP"],
        })
      );
    });
  });

  it("assigns selected candidates to the chosen e-sinav date in bulk", async () => {
    const candidates = [
      {
        id: "cand-1",
        firstName: "Ayse",
        lastName: "Demir",
        nationalId: "20000000114",
        phoneNumber: null,
        email: null,
        birthDate: null,
        gender: null,
        licenseClass: "B",
        existingLicenseType: null,
        existingLicenseIssuedAt: null,
        existingLicenseNumber: null,
        existingLicenseIssuedProvince: null,
        existingLicensePre2016: false,
        status: "active",
        mebExamDate: null,
        drivingExamDate: null,
        eSinavAttemptCount: 1,
        drivingExamAttemptCount: 1,
        currentGroup: null,
        documentSummary: null,
        mebExamResult: null,
        createdAtUtc: "2026-04-01T10:00:00Z",
        updatedAtUtc: "2026-04-02T10:00:00Z",
      },
    ];

    getCandidatesMock.mockResolvedValue({
      items: candidates,
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-06-12", {
        candidateCount: 3,
        time: "09:00",
      }),
    ]);
    updateCandidateMock.mockResolvedValue({
      ...candidates[0],
      mebExamDate: "2026-06-12",
    });
    createCandidateExamAttemptMock.mockResolvedValue({
      id: "attempt-1",
      candidateId: "cand-1",
      examType: "theory",
      scheduledAt: "2026-06-12T06:00:00.000Z",
      attemptNumber: 1,
      score: null,
      expiresAt: null,
      examScheduleId: "e_sinav-2026-06-12",
      examCode: null,
      vehicleId: null,
      vehiclePlate: null,
      instructorId: null,
      instructorFullName: null,
      examAttendanceStatus: null,
      examResultStatus: null,
      fee: 750,
      feeStatus: "pending",
      paidAt: null,
      accountingMovementId: null,
      createdAt: "2026-06-07T08:00:00.000Z",
      rowVersion: 1,
    });

    renderESinavPage();

    await screen.findByText("Ayse Demir");
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Sınav Tarihi Belirle" }));

    const bulkExamDateSelect = screen.getByLabelText(
      "Toplu sınav tarihi seç"
    ) as HTMLSelectElement;
    const optionLabels = Array.from(bulkExamDateSelect.querySelectorAll("option")).map(
      (option) => option.textContent
    );
    expect(optionLabels).toContain("12.06.2026 09:00");
    expect(optionLabels).not.toContain("12.06.2026 09:00 - 3 aday");

    fireEvent.change(screen.getByLabelText("Toplu sınav tarihi seç"), {
      target: { value: "e_sinav-2026-06-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uygula" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "cand-1",
        expect.objectContaining({
          mebExamDate: "2026-06-12",
        })
      );
    });
    expect(listCandidateExamAttemptsMock).toHaveBeenCalledWith("cand-1");
    expect(createCandidateExamAttemptMock).toHaveBeenCalledWith(
      "cand-1",
      expect.objectContaining({
        examType: "theory",
        scheduledAt: "2026-06-12T06:00:00.000Z",
        examScheduleId: "e_sinav-2026-06-12",
      })
    );
    expect(await screen.findByText("Sınav borçlandırması yapılsın mı?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hayır" }));
    await waitFor(() => {
      expect(screen.queryByText("Sınav borçlandırması yapılsın mı?")).not.toBeInTheDocument();
    });
    expect(chargeCandidateExamAttemptMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          eSinavDate: "2026-06-12",
          eSinavScheduleId: "e_sinav-2026-06-12",
          page: 1,
          pageSize: 10,
        })
      );
    });

    expect(screen.getByRole("button", { name: "Sınav Tarihi Belirle" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toplu Seçim" })).not.toBeInTheDocument();
  });

  it("charges selected candidates after bulk e-sinav date assignment when confirmed", async () => {
    const candidates = [
      {
        id: "cand-1",
        firstName: "Ayse",
        lastName: "Demir",
        nationalId: "20000000114",
        phoneNumber: "0555 111 22 33",
        email: null,
        birthDate: null,
        gender: null,
        licenseClass: "B",
        existingLicenseType: null,
        existingLicenseIssuedAt: null,
        existingLicenseNumber: null,
        existingLicenseIssuedProvince: null,
        existingLicensePre2016: false,
        status: "active",
        mebExamDate: null,
        drivingExamDate: null,
        eSinavAttemptCount: 1,
        drivingExamAttemptCount: 1,
        currentGroup: null,
        documentSummary: null,
        mebExamResult: null,
        createdAtUtc: "2026-04-01T10:00:00Z",
        updatedAtUtc: "2026-04-02T10:00:00Z",
      },
    ];
    const attempt = {
      id: "attempt-1",
      candidateId: "cand-1",
      examType: "theory",
      scheduledAt: "2026-06-12T06:00:00.000Z",
      attemptNumber: 1,
      score: null,
      expiresAt: null,
      examScheduleId: "e_sinav-2026-06-12",
      examCode: null,
      vehicleId: null,
      vehiclePlate: null,
      instructorId: null,
      instructorFullName: null,
      examAttendanceStatus: null,
      examResultStatus: null,
      fee: 750,
      feeStatus: "pending",
      paidAt: null,
      accountingMovementId: null,
      createdAt: "2026-06-07T08:00:00.000Z",
      rowVersion: 1,
    };

    getCandidatesMock.mockResolvedValue({
      items: candidates,
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-06-12", { time: "09:00" }),
    ]);
    updateCandidateMock.mockResolvedValue({ ...candidates[0], mebExamDate: "2026-06-12" });
    createCandidateExamAttemptMock.mockResolvedValue(attempt);
    listCandidateExamAttemptsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...attempt, rowVersion: 3 }]);
    updateCandidateExamAttemptMock.mockResolvedValue({ ...attempt, fee: 900, rowVersion: 4 });
    chargeCandidateExamAttemptMock.mockResolvedValue({ ...attempt, fee: 900, feeStatus: "charged" });
    getLicenseClassFeeMatrixMock.mockResolvedValue({
      year: 2026,
      vatRate: 20,
      rows: [
        {
          id: "fee-row-1",
          year: 2026,
          program: {
            id: "license-b",
            code: "B",
            sourceLicenseClass: "",
            sourceLicenseDisplayName: "",
            sourceLicensePre2016: false,
            targetLicenseClass: "B",
            targetLicenseDisplayName: "B",
            minimumAge: 18,
            theoryLessonHours: 34,
            practiceLessonHours: 16,
            courseFee: null,
            mebbisFee: null,
            failureRetryFee: null,
            privateLessonFee: null,
            educationFee: null,
            otherFee1: null,
            yearFeeRowVersion: null,
          },
          lessonType: "theory",
          lessonHours: 34,
          vatIncludedHourlyRate: null,
          vatExcludedHourlyRate: null,
          lessonFee: null,
          vatAmount: null,
          contractTheoryExamFee: null,
          contractPracticeExamFee: null,
          institutionTheoryExamFee: 900,
          institutionPracticeExamFee: null,
          rowVersion: null,
        },
      ],
    });

    renderESinavPage();

    await screen.findByText("Ayse Demir");
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Sınav Tarihi Belirle" }));
    fireEvent.change(screen.getByLabelText("Toplu sınav tarihi seç"), {
      target: { value: "e_sinav-2026-06-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uygula" }));

    fireEvent.click(await screen.findByRole("button", { name: "Evet" }));
    const feeInput = screen.getByLabelText("Ayse Demir sınav ücreti") as HTMLInputElement;
    expect(feeInput.value).toBe("900");
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCandidateExamAttemptMock).toHaveBeenCalledWith(
        "cand-1",
        "attempt-1",
        expect.objectContaining({
          fee: 900,
          feeStatus: "pending",
          rowVersion: 3,
        })
      );
    });
    expect(chargeCandidateExamAttemptMock).toHaveBeenCalledWith("cand-1", "attempt-1");
  });

  it("keeps exam attempt uncharged when bulk exam charge fee is empty", async () => {
    const candidate = {
      id: "cand-1",
      firstName: "Eren",
      lastName: "Test",
      nationalId: "52925238938",
      phoneNumber: "55533322112213",
      email: null,
      birthDate: null,
      gender: null,
      licenseClass: "B",
      existingLicenseType: null,
      existingLicenseIssuedAt: null,
      existingLicenseNumber: null,
      existingLicenseIssuedProvince: null,
      existingLicensePre2016: false,
      status: "active",
      mebExamDate: null,
      drivingExamDate: null,
      eSinavAttemptCount: 1,
      drivingExamAttemptCount: 1,
      currentGroup: null,
      documentSummary: null,
      mebExamResult: null,
      createdAtUtc: "2026-04-01T10:00:00Z",
      updatedAtUtc: "2026-04-02T10:00:00Z",
    };
    const attempt = {
      id: "attempt-1",
      candidateId: "cand-1",
      examType: "theory",
      scheduledAt: "2026-06-12T06:00:00.000Z",
      attemptNumber: 1,
      score: null,
      expiresAt: null,
      examScheduleId: "e_sinav-2026-06-12",
      examCode: null,
      vehicleId: null,
      vehiclePlate: null,
      instructorId: null,
      instructorFullName: null,
      examAttendanceStatus: null,
      examResultStatus: null,
      fee: 0,
      feeStatus: "pending",
      paidAt: null,
      accountingMovementId: null,
      createdAt: "2026-06-07T08:00:00.000Z",
      rowVersion: 1,
    };

    getCandidatesMock.mockResolvedValue({
      items: [candidate],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-06-12", { time: "09:00" }),
    ]);
    updateCandidateMock.mockResolvedValue({ ...candidate, mebExamDate: "2026-06-12" });
    createCandidateExamAttemptMock.mockResolvedValue(attempt);
    listCandidateExamAttemptsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...attempt, rowVersion: 3 }]);
    updateCandidateExamAttemptMock.mockResolvedValue({ ...attempt, fee: 0, rowVersion: 4 });
    getLicenseClassFeeMatrixMock.mockResolvedValue({ year: 2026, vatRate: 20, rows: [] });

    renderESinavPage();

    await screen.findByText("Eren Test");
    fireEvent.click(screen.getByRole("checkbox", { name: "Eren Test seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Sınav Tarihi Belirle" }));
    fireEvent.change(screen.getByLabelText("Toplu sınav tarihi seç"), {
      target: { value: "e_sinav-2026-06-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uygula" }));

    fireEvent.click(await screen.findByRole("button", { name: "Evet" }));
    const feeInput = screen.getByLabelText("Eren Test sınav ücreti") as HTMLInputElement;
    expect(feeInput.value).toBe("0");
    fireEvent.change(feeInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCandidateExamAttemptMock).toHaveBeenCalledWith(
        "cand-1",
        "attempt-1",
        expect.objectContaining({
          fee: 0,
          feeStatus: "pending",
          rowVersion: 3,
        })
      );
    });
    expect(chargeCandidateExamAttemptMock).not.toHaveBeenCalled();
  });

  it("prefills driving exam charge with institution practice exam fee", async () => {
    const candidate = {
      id: "cand-1",
      firstName: "Ayse",
      lastName: "Demir",
      nationalId: "20000000114",
      phoneNumber: "0555 111 22 33",
      email: null,
      birthDate: null,
      gender: null,
      licenseClass: "B",
      existingLicenseType: null,
      existingLicenseIssuedAt: null,
      existingLicenseNumber: null,
      existingLicenseIssuedProvince: null,
      existingLicensePre2016: false,
      status: "active",
      mebExamDate: null,
      drivingExamDate: null,
      eSinavAttemptCount: 1,
      drivingExamAttemptCount: 1,
      currentGroup: null,
      documentSummary: null,
      mebExamResult: null,
      createdAtUtc: "2026-04-01T10:00:00Z",
      updatedAtUtc: "2026-04-02T10:00:00Z",
    };
    const attempt = {
      id: "attempt-1",
      candidateId: "cand-1",
      examType: "practice",
      scheduledAt: "2026-06-12T06:00:00.000Z",
      attemptNumber: 1,
      score: null,
      expiresAt: null,
      examScheduleId: "uygulama-2026-06-12",
      examCode: null,
      vehicleId: null,
      vehiclePlate: null,
      instructorId: null,
      instructorFullName: null,
      examAttendanceStatus: null,
      examResultStatus: null,
      fee: 0,
      feeStatus: "pending",
      paidAt: null,
      accountingMovementId: null,
      createdAt: "2026-06-07T08:00:00.000Z",
      rowVersion: 1,
    };
    const program = {
      id: "license-b",
      code: "B",
      sourceLicenseClass: "",
      sourceLicenseDisplayName: "",
      sourceLicensePre2016: false,
      targetLicenseClass: "B",
      targetLicenseDisplayName: "B",
      minimumAge: 18,
      theoryLessonHours: 34,
      practiceLessonHours: 16,
      courseFee: null,
      mebbisFee: null,
      failureRetryFee: null,
      privateLessonFee: null,
      educationFee: null,
      otherFee1: null,
      yearFeeRowVersion: null,
    };

    getCandidatesMock.mockResolvedValue({
      items: [candidate],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-06-12", { examType: "uygulama", time: "09:00" }),
    ]);
    updateCandidateMock.mockResolvedValue({ ...candidate, drivingExamDate: "2026-06-12" });
    createCandidateExamAttemptMock.mockResolvedValue(attempt);
    getLicenseClassFeeMatrixMock.mockResolvedValue({
      year: 2026,
      vatRate: 20,
      rows: [
        {
          id: "fee-row-theory",
          year: 2026,
          program,
          lessonType: "theory",
          lessonHours: 34,
          vatIncludedHourlyRate: null,
          vatExcludedHourlyRate: null,
          lessonFee: null,
          vatAmount: null,
          contractTheoryExamFee: null,
          contractPracticeExamFee: null,
          institutionTheoryExamFee: 900,
          institutionPracticeExamFee: null,
          rowVersion: null,
        },
        {
          id: "fee-row-practice",
          year: 2026,
          program,
          lessonType: "practice",
          lessonHours: 16,
          vatIncludedHourlyRate: null,
          vatExcludedHourlyRate: null,
          lessonFee: null,
          vatAmount: null,
          contractTheoryExamFee: null,
          contractPracticeExamFee: null,
          institutionTheoryExamFee: null,
          institutionPracticeExamFee: 1500,
          rowVersion: null,
        },
      ],
    });

    renderUygulamaPage();

    await screen.findByText("Ayse Demir");
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Sınav Tarihi Belirle" }));
    fireEvent.change(screen.getByLabelText("Toplu sınav tarihi seç"), {
      target: { value: "uygulama-2026-06-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uygula" }));

    fireEvent.click(await screen.findByRole("button", { name: "Evet" }));
    const feeInput = screen.getByLabelText("Ayse Demir sınav ücreti") as HTMLInputElement;
    expect(feeInput.value).toBe("1500");
  });

  it("renames a tag from the global tag manager", async () => {
    searchCandidateTagsMock.mockResolvedValue([
      { id: "tag-1", name: "Referans", usageCount: 2 },
    ]);
    updateCandidateTagMock.mockResolvedValue({
      id: "tag-1",
      name: "VIP",
      usageCount: 2,
    });

    renderPage();

    await screen.findByRole("button", { name: "Referans" });
    fireEvent.click(screen.getByRole("button", { name: "Etiketleri Yönet" }));

    const dialog = screen.getByRole("dialog");
    const row = within(dialog).getByText("Referans").closest(".tag-manager-row");
    expect(row).toBeTruthy();

    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "Düzenle" }));
    fireEvent.change(screen.getByLabelText("Referans etiket adı"), {
      target: { value: "VIP" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCandidateTagMock).toHaveBeenCalledWith("tag-1", "VIP");
    });
  });

  it("deletes a tag from the global tag manager", async () => {
    searchCandidateTagsMock.mockResolvedValue([
      { id: "tag-1", name: "Referans", usageCount: 3 },
    ]);
    deleteCandidateTagMock.mockResolvedValue(undefined);

    renderPage();

    await screen.findByRole("button", { name: "Referans" });
    fireEvent.click(screen.getByRole("button", { name: "Etiketleri Yönet" }));

    const dialog = screen.getByRole("dialog");
    const row = within(dialog).getByText("Referans").closest(".tag-manager-row");
    expect(row).toBeTruthy();

    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "Sil" }));
    fireEvent.click(screen.getByRole("button", { name: "Evet, Sil" }));

    await waitFor(() => {
      expect(deleteCandidateTagMock).toHaveBeenCalledWith("tag-1");
    });
  });

  it("hides the current tab status from the bulk status dropdown", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "20000000114",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });

    renderPage();

    await screen.findByText("Ayse Demir");
    showBulkSelection();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Durum Değiştir" }));

    const bulkStatusSelect = screen.getByLabelText("Toplu durum seç");
    const optionValues = Array.from(
      (bulkStatusSelect as HTMLSelectElement).querySelectorAll("option")
    ).map((option) => option.value);

    expect(optionValues).toEqual(["", "pre_registered", "active", "parked", "graduated", "dropped"]);
  });
});

describe("CandidatesPage sorting", () => {
  beforeEach(() => {
    localStorage.clear();
    getCandidatesMock.mockReset();
    getGroupsMock.mockReset();
    getExamCodesMock.mockReset();
    searchCandidateTagsMock.mockReset();
    searchCandidateTagsMock.mockResolvedValue([]);
    getGroupsMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 200,
      totalCount: 0,
      totalPages: 0,
    });
    getExamCodesMock.mockResolvedValue([]);
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
        })
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
        })
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

  it("sends sort params together with the selected candidate tab filter", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Mezun" }));
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "graduated" })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Grup" }));
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "graduated",
          sortBy: "groupTitle",
          sortDir: "asc",
          page: 1,
        })
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
    fireEvent.click(await screen.findByRole("button", { name: /Sonraki/ }));
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Ad Soyad/ }));
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sortBy: "name",
          sortDir: "asc",
          page: 1,
        })
      );
    });
  });
});

describe("CandidatesPage filter panel", () => {
  beforeEach(() => {
    localStorage.clear();
    getCandidatesMock.mockReset();
    getGroupsMock.mockReset();
    getExamCodesMock.mockReset();
    searchCandidateTagsMock.mockReset();
    searchCandidateTagsMock.mockResolvedValue([]);
    getGroupsMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 200,
      totalCount: 0,
      totalPages: 0,
    });
    getExamCodesMock.mockResolvedValue([]);
    getCandidatesMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalCount: 0,
      totalPages: 1,
    });
  });

  it("is collapsed by default and opens when the Filtreler button is clicked", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    // Inputs inside the panel are not rendered while collapsed.
    expect(screen.queryByLabelText(/^Ad$/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Filtreler/ }));

    // After toggling the panel, individual inputs become available.
    expect(screen.getByPlaceholderText("Ad")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Soyad")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("TC Kimlik")).toBeInTheDocument();
  });

  it("sends firstName to the candidates query when typed into the filter input", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Filtreler/ }));

    const firstNameInput = screen.getByPlaceholderText("Ad") as HTMLInputElement;

    fireEvent.change(firstNameInput, { target: { value: "Ayse" } });

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          firstName: "Ayse",
          page: 1,
        })
      );
    });
  });

  it("does not send a text filter until the second character", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Filtreler/ }));

    const firstNameInput = screen.getByPlaceholderText("Ad") as HTMLInputElement;

    fireEvent.change(firstNameInput, { target: { value: "A" } });

    await new Promise((resolve) => setTimeout(resolve, 350));

    let lastCall = getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1]?.[0];
    expect(lastCall.firstName).toBeUndefined();

    fireEvent.change(firstNameInput, { target: { value: "Ay" } });

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          firstName: "Ay",
          page: 1,
        })
      );
    });
  });

  it("sends tri-state hasPhoto=true when selected from the filter dropdown", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Filtreler/ }));

    const hasPhotoSelect = screen.getByLabelText(
      "Fotoğrafı Var"
    ) as HTMLSelectElement;
    fireEvent.change(hasPhotoSelect, { target: { value: "true" } });

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          hasPhoto: true,
          page: 1,
        })
      );
    });
  });

  it("resets to page 1 when a filter changes after navigating to a later page", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 10,
      totalCount: 25,
      totalPages: 3,
    });

    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    // Navigate to page 2 via the pager.
    fireEvent.click(await screen.findByRole("button", { name: /Sonraki/ }));
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });

    // Open the panel and change a filter — page should reset to 1.
    fireEvent.click(screen.getByRole("button", { name: /Filtreler/ }));
    const nationalIdInput = screen.getByPlaceholderText(
      "TC Kimlik"
    ) as HTMLInputElement;
    fireEvent.change(nationalIdInput, { target: { value: "123" } });

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          nationalId: "123",
          page: 1,
        })
      );
    });
  });

  it("clears all text filters when the clear button is clicked", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Filtreler/ }));

    const firstNameInput = screen.getByPlaceholderText("Ad") as HTMLInputElement;
    fireEvent.change(firstNameInput, { target: { value: "Ayse" } });

    // Clear button only appears once a filter is active.
    const clearButton = await screen.findByRole("button", {
      name: /Filtreleri Temizle/i,
    });
    fireEvent.click(clearButton);

    await waitFor(() => {
      const lastCall =
        getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1]?.[0];
      expect(lastCall.firstName).toBeUndefined();
    });
  });

  it("sends canonical English gender as the query param when selected", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Filtreler/ }));

    // The filter panel exposes the gender select via an accessible name that
    // matches the Turkish column header ("Cinsiyet").
    const genderSelect = screen.getByLabelText("Cinsiyet") as HTMLSelectElement;

    fireEvent.change(genderSelect, { target: { value: "female" } });

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          gender: "female",
          page: 1,
        })
      );
    });

    fireEvent.change(genderSelect, { target: { value: "male" } });

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          gender: "male",
          page: 1,
        })
      );
    });

    // Clearing the select drops the query param entirely — never sends
    // an empty string or a legacy value.
    fireEvent.change(genderSelect, { target: { value: "" } });

    await waitFor(() => {
      const lastCall =
        getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1]?.[0];
      expect(lastCall.gender).toBeUndefined();
    });
  });
});

describe("CandidatesPage gender rendering", () => {
  beforeEach(() => {
    localStorage.clear();
    getCandidatesMock.mockReset();
    searchCandidateTagsMock.mockReset();
    searchCandidateTagsMock.mockResolvedValue([]);
  });

  it("maps canonical backend gender onto Turkish labels in the table", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "10000000078",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: "female",
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
        {
          id: "cand-2",
          firstName: "Mehmet",
          lastName: "Kaya",
          nationalId: "10000000146",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: "male",
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
        {
          id: "cand-3",
          firstName: "Ali",
          lastName: "Veli",
          nationalId: "10000000214",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: "unspecified",
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 3,
      totalPages: 1,
    });

    renderPage();

    expect(await screen.findByText("Ayse Demir")).toBeInTheDocument();

    // Gender column is optional / hidden by default — enable it via the
    // column picker so its cells render.
    fireEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    fireEvent.click(screen.getByLabelText("Cinsiyet"));

    expect(screen.getByText("Kadın")).toBeInTheDocument();
    expect(screen.getByText("Erkek")).toBeInTheDocument();
    expect(screen.getByText("Seçilmemiş")).toBeInTheDocument();
  });
});

describe("CandidatesPage bulk status update", () => {
  beforeEach(() => {
    localStorage.clear();
    getCandidatesMock.mockReset();
    updateCandidateMock.mockReset();
    searchCandidateTagsMock.mockReset();
    searchCandidateTagsMock.mockResolvedValue([]);
  });

  it("normalizes legacy gender values to canonical English in update payloads", async () => {
    const candidates = [
      {
        id: "cand-1",
        firstName: "Ayse",
        lastName: "Demir",
        nationalId: "20000000114",
        phoneNumber: null,
        email: null,
        birthDate: null,
        // A stale/legacy Turkish value that may still exist in memory from
        // older sessions — must be normalized to "female" before sending.
        gender: "kadın",
        licenseClass: "B",
        existingLicenseType: null,
        existingLicenseIssuedAt: null,
        existingLicenseNumber: null,
        existingLicenseIssuedProvince: null,
        existingLicensePre2016: false,
        status: "active",
        currentGroup: null,
        documentSummary: null,
        mebExamResult: null,
        createdAtUtc: "2026-04-01T10:00:00Z",
        updatedAtUtc: "2026-04-02T10:00:00Z",
      },
    ];

    getCandidatesMock.mockResolvedValue({
      items: candidates,
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });
    updateCandidateMock.mockResolvedValue(candidates[0]);

    renderPage();

    await screen.findByText("Ayse Demir");
    showBulkSelection();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Durum Değiştir" }));
    fireEvent.change(screen.getByLabelText("Toplu durum seç"), {
      target: { value: "parked" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uygula" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "cand-1",
        expect.objectContaining({
          status: "parked",
          gender: "female",
        })
      );
    });
  });
});
