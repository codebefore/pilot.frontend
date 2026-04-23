import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CandidatesPage } from "./CandidatesPage";
import { ExamDireksiyonPage } from "./ExamDireksiyonPage";
import { ExamESinavPage } from "./ExamESinavPage";
import { CandidateExamDateSidebar } from "../components/candidates/CandidateExamDateSidebar";
import { renderWithProviders } from "../test/render-with-providers";

const getCandidatesMock = vi.fn();
const getExamScheduleOptionsMock = vi.fn();
const syncExamSchedulesMock = vi.fn();
const getCandidateByIdMock = vi.fn();
const updateCandidateMock = vi.fn();
const updateCandidateTagMock = vi.fn();
const deleteCandidateTagMock = vi.fn();
const searchCandidateTagsMock = vi.fn();

vi.mock("../lib/candidates-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/candidates-api")>(
    "../lib/candidates-api"
  );
  return {
    ...actual,
    getCandidates: (...args: Parameters<typeof actual.getCandidates>) =>
      getCandidatesMock(...args),
    getExamScheduleOptions: (
      ...args: Parameters<typeof actual.getExamScheduleOptions>
    ) => getExamScheduleOptionsMock(...args),
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
    assignCandidateGroup: vi.fn(),
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
    createExamSchedule: vi.fn(),
    syncExamSchedules: (...args: Parameters<typeof actual.syncExamSchedules>) =>
      syncExamSchedulesMock(...args),
  };
});

function examScheduleOption(
  date: string,
  overrides: Partial<{
    id: string;
    examType: "e_sinav" | "direksiyon";
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

function renderESinavPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/exams/e-sinav"]}>
      <ExamESinavPage />
    </MemoryRouter>
  );
}

function renderDireksiyonPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/exams/direksiyon"]}>
      <ExamDireksiyonPage />
    </MemoryRouter>
  );
}

describe("CandidatesPage tabs", () => {
  beforeEach(() => {
    localStorage.clear();
    getCandidatesMock.mockReset();
    getExamScheduleOptionsMock.mockReset();
    syncExamSchedulesMock.mockReset();
    getCandidateByIdMock.mockReset();
    updateCandidateMock.mockReset();
    updateCandidateTagMock.mockReset();
    deleteCandidateTagMock.mockReset();
    searchCandidateTagsMock.mockReset();
    searchCandidateTagsMock.mockResolvedValue([]);
    getExamScheduleOptionsMock.mockResolvedValue([]);
    syncExamSchedulesMock.mockResolvedValue({
      examType: "e_sinav",
      createdCount: 0,
      dateCount: 0,
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

  it("defaults to the 'active' tab and sends status='active'", async () => {
    renderPage();

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenCalled();
    });

    const callArgs = getCandidatesMock.mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({ status: "active", page: 1, pageSize: 10 });
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
        }),
        expect.any(AbortSignal)
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
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("renders direksiyon tabs and defaults to the havuz filter", async () => {
    renderDireksiyonPage();

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

  it("sends the selected direksiyon tab key to the candidate query", async () => {
    renderDireksiyonPage();

    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Başarısız" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          drivingExamTab: "basarisiz",
          page: 1,
          pageSize: 10,
        }),
        expect.any(AbortSignal)
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
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("loads e-sinav date options without the havuz tab constraint", async () => {
    renderESinavPage();

    await waitFor(() => {
      const params = getExamScheduleOptionsMock.mock.calls[0]?.[0];
      expect(params.examType).toBe("e_sinav");
      expect(params.status).toBe("active");
      expect(params.eSinavTab).toBeUndefined();
    });
  });

  it("loads direksiyon date options without the havuz tab constraint", async () => {
    renderDireksiyonPage();

    await waitFor(() => {
      const params = getExamScheduleOptionsMock.mock.calls[0]?.[0];
      expect(params.examType).toBe("direksiyon");
      expect(params.status).toBe("active");
      expect(params.drivingExamTab).toBeUndefined();
    });
  });

  it("shows exam toolbar actions only on exam pages", async () => {
    const examView = renderESinavPage();

    expect(await screen.findByRole("button", { name: "Tarih Ekle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Senkronize" })).toBeInTheDocument();

    examView.unmount();
    renderPage();

    expect(screen.queryByRole("button", { name: "Tarih Ekle" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Senkronize" })).not.toBeInTheDocument();
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
      "Tarih Ekle",
      "Senkronize",
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

    expect(sidebarButtons[0]).toBe("Tarih Ekle");
    expect(sidebarButtons[1]).toBe("Senkronize");
  });

  it("calls the backend sync endpoint from the e-sinav action", async () => {
    renderESinavPage();

    fireEvent.click(await screen.findByRole("button", { name: "Senkronize" }));

    await waitFor(() => {
      expect(syncExamSchedulesMock).toHaveBeenCalledWith("e_sinav");
    });
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
        selectedDate=""
        title="E-Sınav Tarihi"
      />
    );

    const sidebar = view.container.querySelector(".exam-date-sidebar-list") as HTMLElement;
    const groups = Array.from(sidebar.querySelectorAll(".exam-date-option-group"));

    const firstDivider = within(sidebar).getByTestId("exam-date-divider");
    expect(groups.findIndex((group) => group.contains(firstDivider))).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    const movedDivider = within(sidebar).getByTestId("exam-date-divider");
    expect(groups.findIndex((group) => group.contains(movedDivider))).toBe(0);
  });

  it("moves e-sinav from havuz to randevulu when a date is selected", async () => {
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-05-12", { candidateCount: 3 }),
    ]);

    renderESinavPage();

    const dateButton = await screen.findByRole("button", { name: /12\.05\.2026/i });
    fireEvent.click(dateButton);

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          eSinavTab: "randevulu",
          eSinavDate: "2026-05-12",
          page: 1,
          pageSize: 10,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("uses the new e-sinav column storage key so old visibility state is ignored", async () => {
    localStorage.setItem("exams.e-sinav.columns.v2", JSON.stringify(["photo", "name"]));

    renderESinavPage();

    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(
      await screen.findByRole("columnheader", { name: "Tarih" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Hak" })
    ).toBeInTheDocument();
  });

  it("uses the new direksiyon column storage key so old visibility state is ignored", async () => {
    localStorage.setItem("exams.direksiyon.columns.v2", JSON.stringify(["photo", "name"]));

    renderDireksiyonPage();

    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(
      await screen.findByRole("columnheader", { name: "Tarih" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Hak" })
    ).toBeInTheDocument();
  });

  it("filters the direksiyon page by the selected driving exam date", async () => {
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-06-03", {
        examType: "direksiyon",
        candidateCount: 2,
      }),
    ]);

    renderDireksiyonPage();

    await waitFor(() => {
      expect(getExamScheduleOptionsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          examType: "direksiyon",
          status: "active",
        }),
        expect.any(AbortSignal)
      );
    });

    const sidebar = document.querySelector(".exam-date-sidebar-list") as HTMLElement | null;
    expect(sidebar).not.toBeNull();
    if (!sidebar) {
      throw new Error("exam date sidebar not found");
    }

    fireEvent.click(await within(sidebar).findByRole("button", { name: /03\.06\.2026/i }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          drivingExamTab: "randevulu",
          drivingExamDate: "2026-06-03",
          page: 1,
          pageSize: 10,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("renders the direksiyon sidebar summary without license class counts", async () => {
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-06-03", {
        examType: "direksiyon",
        capacity: 12,
        candidateCount: 4,
        licenseClassCounts: [
          { licenseClass: "A2", count: 1 },
          { licenseClass: "B", count: 3 },
        ],
      }),
    ]);

    const view = renderDireksiyonPage();
    const sidebar = view.container.querySelector(".exam-date-sidebar-list") as HTMLElement | null;
    expect(sidebar).not.toBeNull();
    if (!sidebar) {
      throw new Error("exam date sidebar not found");
    }

    expect(
      await within(sidebar).findByRole("button", {
        name: /03\.06\.2026\s*4\/12/i,
      })
    ).toBeInTheDocument();
    expect(within(sidebar).queryByText("09:00")).not.toBeInTheDocument();
    expect(within(sidebar).queryByText(/B\(3\)|A2\(1\)/i)).not.toBeInTheDocument();
  });

  it("renders one aggregate direksiyon license summary in the tag row", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalCount: 8,
      totalPages: 1,
      licenseClassCounts: [{ licenseClass: "B", count: 8 }],
    });
    getExamScheduleOptionsMock.mockResolvedValue([
      examScheduleOption("2026-06-03", {
        examType: "direksiyon",
        capacity: 10,
        candidateCount: 2,
        licenseClassCounts: [
          { licenseClass: "B", count: 2 },
        ],
      }),
      examScheduleOption("2026-06-07", {
        examType: "direksiyon",
        capacity: 14,
        candidateCount: 2,
        licenseClassCounts: [
          { licenseClass: "B", count: 2 },
        ],
      }),
      examScheduleOption("2026-06-12", {
        examType: "direksiyon",
        capacity: 12,
        candidateCount: 2,
        licenseClassCounts: [
          { licenseClass: "B", count: 2 },
        ],
      }),
      examScheduleOption("2026-06-20", {
        examType: "direksiyon",
        capacity: 20,
        candidateCount: 2,
        licenseClassCounts: [
          { licenseClass: "B", count: 2 },
        ],
      }),
    ]);

    const view = renderDireksiyonPage();
    const tagBar = view.container.querySelector(".tag-filter-bar") as HTMLElement | null;

    expect(tagBar).not.toBeNull();
    if (!tagBar) {
      throw new Error("tag filter bar not found");
    }

    expect(await within(tagBar).findByLabelText("Ehliyet sınıfı özeti"))
      .toHaveTextContent("B(8) A2(0)");
    expect(within(tagBar).queryByText(/\(2\/10\)\s*B\(2\)/i)).not.toBeInTheDocument();
  });

  it("renders exactly the 5 canonical candidate status tabs", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: "Tümü" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ön Kayıt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aktif" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Park" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mezun" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dosya Yakan" })).toBeInTheDocument();

    // Legacy tabs must not exist anymore.
    expect(screen.queryByRole("button", { name: "Tüm Adaylar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tamamlanan" })).not.toBeInTheDocument();
  });

  it("does not send status when the Tümü tab is selected", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Tümü" }));

    await waitFor(() => {
      const lastCall = getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1]?.[0];
      expect(lastCall.status).toBeUndefined();
      expect(lastCall.page).toBe(1);
      expect(lastCall.pageSize).toBe(10);
    });
  });

  it("shows status by default and still lets the user hide it from the picker", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(screen.getByRole("columnheader", { name: /^Durum$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    fireEvent.click(screen.getByLabelText("Durum"));

    await waitFor(() => {
      expect(screen.queryByRole("columnheader", { name: /^Durum$/i })).not.toBeInTheDocument();
    });
  });

  it("sends status='pre_registered' when the Ön Kayıt tab is selected", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Ön Kayıt" }));

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
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("keeps optional candidate columns hidden by default but lists them in the picker", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(screen.queryByText("Telefon")).not.toBeInTheDocument();
    expect(screen.queryByText("E-posta")).not.toBeInTheDocument();
    expect(screen.queryByText("Kayıt Tarihi")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sütunlar" }));

    expect(screen.getByText("Telefon")).toBeInTheDocument();
    expect(screen.getByText("E-posta")).toBeInTheDocument();
    expect(screen.getByText("Kayıt Tarihi")).toBeInTheDocument();
    expect(screen.getByText("Güncelleme Tarihi")).toBeInTheDocument();
    expect(screen.getByText("Ehliyet Tipi")).toBeInTheDocument();
  });

  it("does not render or list exam-only columns on the main candidates page", async () => {
    localStorage.setItem(
      "candidates.columns.v8",
      JSON.stringify(["name", "eSinavDate", "eSinavAttemptCount", "drivingExamDate"])
    );

    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(screen.queryByRole("columnheader", { name: "E-Sınav Tarihi" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "E-Sınav Hakkı" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Direksiyon Tarihi" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Direksiyon Hakkı" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    const picker = document.querySelector(".column-picker-menu") as HTMLElement | null;
    expect(picker).not.toBeNull();
    if (!picker) {
      throw new Error("column picker menu not found");
    }

    expect(within(picker).queryByText("E-Sınav Tarihi")).not.toBeInTheDocument();
    expect(within(picker).queryByText("E-Sınav Hakkı")).not.toBeInTheDocument();
    expect(within(picker).queryByText("Direksiyon Tarihi")).not.toBeInTheDocument();
    expect(within(picker).queryByText("Direksiyon Hakkı")).not.toBeInTheDocument();
  });

  it("keeps e-sinav date columns visible but out of the picker", async () => {
    renderESinavPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(await screen.findByRole("columnheader", { name: "Tarih" })).toBeInTheDocument();
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

  it("keeps direksiyon date columns visible but out of the picker", async () => {
    renderDireksiyonPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(await screen.findByRole("columnheader", { name: "Tarih" })).toBeInTheDocument();
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

  it("renders the group column with the term month in the same cell", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "12345678901",
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
          nationalId: "12345678901",
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
    expect(screen.getByText("NİSAN 2026 / 2")).toBeInTheDocument();
    expect(screen.queryByText("NİSAN 2026 - 1B")).not.toBeInTheDocument();
  });

  it("renders biometric photo when present and initials fallback otherwise", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "12345678901",
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
          nationalId: "12345678901",
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
          nationalId: "12345678901",
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
    expect(
      screen.queryByRole("checkbox", { name: "Bu sayfadaki tüm adayları seç" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toplu Seçim" }));

    expect(screen.queryByRole("button", { name: "Yeni Aday" })).not.toBeInTheDocument();
    expect(screen.queryByText("0 seçili")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Etiket Ekle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Durum Değiştir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dışa Aktar" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Toplu durum seç")).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Bu sayfadaki tüm adayları seç" })
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Ayse Demir seç" })).toBeInTheDocument();
  });

  it("reveals export actions only inside bulk selection", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "12345678901",
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
    expect(screen.queryByRole("button", { name: "Dışa Aktar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "CSV İndir" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toplu Seçim" }));
    fireEvent.click(screen.getByRole("button", { name: "Dışa Aktar" }));

    expect(await screen.findByText("Önce en az bir aday seç")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "CSV İndir" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Dışa Aktar" }));

    expect(screen.queryByRole("button", { name: "Yeni Aday" })).not.toBeInTheDocument();
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
          nationalId: "12345678901",
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
    fireEvent.click(screen.getByRole("button", { name: "Toplu Seçim" }));
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
          nationalId: "12345678901",
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
    fireEvent.click(screen.getByRole("button", { name: "Toplu Seçim" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Durum Değiştir" }));
    fireEvent.click(screen.getByRole("button", { name: "Durum seç" }));

    expect(await screen.findByRole("option", { name: "Park" })).toBeInTheDocument();
  });

  it("selects visible rows with the bulk selection header checkbox", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "12345678901",
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
    fireEvent.click(screen.getByRole("button", { name: "Toplu Seçim" }));

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
        nationalId: "12345678901",
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
    fireEvent.click(screen.getByRole("button", { name: "Toplu Seçim" }));
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

  it("applies bulk tag update to selected candidates without dropping existing tags", async () => {
    const candidates = [
      {
        id: "cand-1",
        firstName: "Ayse",
        lastName: "Demir",
        nationalId: "12345678901",
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
    fireEvent.click(screen.getByRole("button", { name: "Toplu Seçim" }));
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
          nationalId: "12345678901",
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
    fireEvent.click(screen.getByRole("button", { name: "Toplu Seçim" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Durum Değiştir" }));

    const bulkStatusSelect = screen.getByLabelText("Toplu durum seç");
    const optionValues = Array.from(
      (bulkStatusSelect as HTMLSelectElement).querySelectorAll("option")
    ).map((option) => option.value);

    expect(optionValues).not.toContain("active");
    expect(optionValues).toEqual(["", "pre_registered", "parked", "graduated", "dropped"]);

    fireEvent.click(screen.getByRole("button", { name: "Tümü" }));

    await waitFor(() => {
      const allTabOptionValues = Array.from(
        (screen.getByLabelText("Toplu durum seç") as HTMLSelectElement).querySelectorAll("option")
      ).map((option) => option.value);

      expect(allTabOptionValues).toContain("active");
    });
  });
});

describe("CandidatesPage sorting", () => {
  beforeEach(() => {
    localStorage.clear();
    getCandidatesMock.mockReset();
    searchCandidateTagsMock.mockReset();
    searchCandidateTagsMock.mockResolvedValue([]);
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

describe("CandidatesPage filter panel", () => {
  beforeEach(() => {
    localStorage.clear();
    getCandidatesMock.mockReset();
    searchCandidateTagsMock.mockReset();
    searchCandidateTagsMock.mockResolvedValue([]);
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

    fireEvent.click(screen.getByRole("checkbox", { name: /Filtreler/ }));

    // After toggling the panel, individual inputs become available.
    expect(screen.getByPlaceholderText("Ad")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Soyad")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("TC Kimlik")).toBeInTheDocument();
  });

  it("sends firstName to the candidates query when typed into the filter input", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("checkbox", { name: /Filtreler/ }));

    const firstNameInput = screen.getByPlaceholderText("Ad") as HTMLInputElement;

    fireEvent.change(firstNameInput, { target: { value: "Ayse" } });

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          firstName: "Ayse",
          page: 1,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("does not send a text filter until the second character", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("checkbox", { name: /Filtreler/ }));

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
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("sends tri-state hasPhoto=true when selected from the filter dropdown", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("checkbox", { name: /Filtreler/ }));

    const hasPhotoSelect = screen.getByLabelText(
      "Fotoğrafı Var"
    ) as HTMLSelectElement;
    fireEvent.change(hasPhotoSelect, { target: { value: "true" } });

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          hasPhoto: true,
          page: 1,
        }),
        expect.any(AbortSignal)
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
    fireEvent.click(screen.getByRole("button", { name: /Sonraki/ }));
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
        expect.any(AbortSignal)
      );
    });

    // Open the panel and change a filter — page should reset to 1.
    fireEvent.click(screen.getByRole("checkbox", { name: /Filtreler/ }));
    const nationalIdInput = screen.getByPlaceholderText(
      "TC Kimlik"
    ) as HTMLInputElement;
    fireEvent.change(nationalIdInput, { target: { value: "123" } });

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          nationalId: "123",
          page: 1,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("clears all text filters when the clear button is clicked", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("checkbox", { name: /Filtreler/ }));

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

    fireEvent.click(screen.getByRole("checkbox", { name: /Filtreler/ }));

    // The filter panel exposes the gender select via an accessible name that
    // matches the Turkish column header ("Cinsiyet").
    const genderSelect = screen.getByLabelText("Cinsiyet") as HTMLSelectElement;

    fireEvent.change(genderSelect, { target: { value: "female" } });

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          gender: "female",
          page: 1,
        }),
        expect.any(AbortSignal)
      );
    });

    fireEvent.change(genderSelect, { target: { value: "male" } });

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          gender: "male",
          page: 1,
        }),
        expect.any(AbortSignal)
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
          nationalId: "11111111111",
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
          nationalId: "22222222222",
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
          nationalId: "33333333333",
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
        nationalId: "12345678901",
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
    fireEvent.click(screen.getByRole("button", { name: "Toplu Seçim" }));
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
