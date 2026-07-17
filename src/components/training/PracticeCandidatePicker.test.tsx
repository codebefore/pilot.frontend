import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { createRef, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import {
  PracticeCandidatePicker,
  type PracticeCandidatePickerHandle,
} from "./PracticeCandidatePicker";

const getPracticeCandidatesMock = vi.fn();
const getCandidatePhotosByCandidateIdsMock = vi.fn();

vi.mock("../../lib/practice-candidates-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/practice-candidates-api")>(
    "../../lib/practice-candidates-api"
  );
  return {
    ...actual,
    getPracticeCandidates: (...args: Parameters<typeof actual.getPracticeCandidates>) =>
      getPracticeCandidatesMock(...args),
  };
});

vi.mock("../../lib/documents-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/documents-api")>(
    "../../lib/documents-api"
  );
  return {
    ...actual,
    getCandidatePhotosByCandidateIds: (...args: unknown[]) =>
      getCandidatePhotosByCandidateIdsMock(...args),
  };
});

describe("PracticeCandidatePicker", () => {
  beforeEach(() => {
    localStorage.clear();
    getPracticeCandidatesMock.mockReset();
    getCandidatePhotosByCandidateIdsMock.mockReset();
    getCandidatePhotosByCandidateIdsMock.mockResolvedValue([]);
    getPracticeCandidatesMock.mockResolvedValue({
      items: [
        {
          candidateId: "candidate-1",
          registrationNumber: "A-001",
          fullName: "Ayşe Yılmaz",
          firstName: "Ayşe",
          lastName: "Yılmaz",
          gender: "female",
          photo: null,
          licenseClass: "B",
          existingLicenseType: "A1",
          groupId: null,
          groupTitle: null,
          attemptNumber: 1,
          maxAttemptCount: 4,
          attemptSlotLabel: "1/4",
          practiceRoundNumber: 1,
          totalAttemptNumber: 1,
          completedPracticeHours: 2,
          targetPracticeHours: 16,
          remainingPracticeHours: 14,
          lastPracticeLessonAt: null,
          tabStatus: "havuz",
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 1,
      totalPages: 1,
      tabCounts: { all: 1, havuz: 1, basarisiz: 0, randevulu: 0 },
      filterOptions: { licenseClasses: ["B"], groups: [] },
    });
  });

  it("adds and removes the existing-license column from the column picker", async () => {
    const onAssign = vi.fn();
    renderWithProviders(
      <MemoryRouter>
        <PracticeCandidatePicker
          onAssign={onAssign}
          onSelectionChange={() => {}}
          selectedCandidateIds={new Set()}
        />
      </MemoryRouter>
    );

    await screen.findByText("Ayşe Yılmaz");
    expect(screen.getByRole("link", { name: "Ayşe Yılmaz" })).toHaveAttribute(
      "href",
      "/candidates/candidate-1"
    );
    fireEvent.click(screen.getByRole("link", { name: "Ayşe Yılmaz" }));
    expect(onAssign).toHaveBeenCalledWith("candidate-1");
    expect(screen.getByRole("link", { name: "Ayşe Yılmaz aday detayını aç" })).toHaveAttribute(
      "href",
      "/candidates/candidate-1"
    );
    expect(screen.queryByRole("columnheader", { name: "Mevcut Ehliyet Tipi" })).not.toBeInTheDocument();

    const columnPickerButton = screen.getByRole("button", { name: "Sütunlar" });
    expect(screen.getByRole("columnheader", { name: "Detay" }).nextElementSibling).toContainElement(
      columnPickerButton
    );

    fireEvent.click(columnPickerButton);
    fireEvent.click(screen.getByLabelText("Mevcut Ehliyet Tipi"));

    const existingLicenseHeader = screen.getByRole("columnheader", { name: "Mevcut Ehliyet Tipi" });
    expect(existingLicenseHeader.nextElementSibling).toBe(
      screen.getByRole("columnheader", { name: "Ehlyt" })
    );
    expect(screen.getByText("A1")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Mevcut Ehliyet Tipi"));

    expect(screen.queryByRole("columnheader", { name: "Mevcut Ehliyet Tipi" })).not.toBeInTheDocument();
  });

  it("selects and clears every candidate on the visible page", async () => {
    const onSelectionChange = vi.fn();
    function SelectionHarness() {
      const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
      return (
        <PracticeCandidatePicker
          onAssign={vi.fn()}
          onSelectionChange={(next) => {
            onSelectionChange(next);
            setSelectedCandidateIds(next);
          }}
          selectedCandidateIds={selectedCandidateIds}
        />
      );
    }

    renderWithProviders(
      <MemoryRouter>
        <SelectionHarness />
      </MemoryRouter>
    );

    await screen.findByText("Ayşe Yılmaz");
    fireEvent.click(screen.getByRole("checkbox", { name: "Bu sayfadaki tüm adayları seç" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["candidate-1"]));

    fireEvent.click(screen.getByRole("checkbox", { name: "Bu sayfadaki tüm adayları seç" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set());
  });

  it("finds selected candidates across all pages for export", async () => {
    const pickerRef = createRef<PracticeCandidatePickerHandle>();
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:practice-candidates");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const firstPage = await getPracticeCandidatesMock();
    getPracticeCandidatesMock.mockReset();
    getPracticeCandidatesMock
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce({ ...firstPage, totalCount: 2, totalPages: 2 })
      .mockResolvedValueOnce({
        ...firstPage,
        items: [
          {
            ...firstPage.items[0],
            candidateId: "candidate-2",
            registrationNumber: "A-002",
            fullName: "Mehmet Kaya",
          },
        ],
        page: 2,
        totalCount: 2,
        totalPages: 2,
      });

    renderWithProviders(
      <MemoryRouter>
        <PracticeCandidatePicker
          ref={pickerRef}
          onAssign={vi.fn()}
          onSelectionChange={() => {}}
          selectedCandidateIds={new Set()}
        />
      </MemoryRouter>
    );

    await screen.findByText("Ayşe Yılmaz");
    act(() =>
      pickerRef.current?.exportCandidates("excel", new Set(["candidate-2"]))
    );

    await waitFor(() => expect(getPracticeCandidatesMock).toHaveBeenCalledTimes(3));
    expect(getPracticeCandidatesMock.mock.calls[1]?.[0]).toMatchObject({
      page: 1,
      pageSize: 100,
      tab: "all",
    });
    expect(getPracticeCandidatesMock.mock.calls[2]?.[0]).toMatchObject({
      page: 2,
      pageSize: 100,
      tab: "all",
    });
    expect(createObjectUrl).toHaveBeenCalledOnce();
    const exportedBlob = createObjectUrl.mock.calls[0]?.[0];
    expect(exportedBlob).toBeInstanceOf(Blob);
    const exportedHtml = await (exportedBlob as Blob).text();
    expect(exportedHtml).toContain("<th>Aday</th>");
    expect(exportedHtml).toContain("<th>Ehlyt</th>");
    expect(exportedHtml).not.toContain("Mevcut Ehliyet Tipi");
    expect(exportedHtml).not.toContain("Kayıt No");
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledOnce();

    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
    anchorClick.mockRestore();
  });
});
