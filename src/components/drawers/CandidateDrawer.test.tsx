import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CandidateDrawer } from "./CandidateDrawer";
import { renderWithProviders } from "../../test/render-with-providers";

const getCandidateByIdMock = vi.fn();
const updateCandidateMock = vi.fn();
const assignCandidateGroupMock = vi.fn();
const removeActiveGroupAssignmentMock = vi.fn();
const getGroupsMock = vi.fn();

function getHiddenSelect(ariaLabel: string) {
  return document.querySelector(
    `select[aria-label="${ariaLabel}"]`
  ) as HTMLSelectElement | null;
}

vi.mock("../../lib/authorized-files", () => ({
  createAuthorizedObjectUrl: (url: string) => Promise.resolve(url),
  openAuthorizedFile: vi.fn(),
  downloadAuthorizedFile: vi.fn(),
  printAuthorizedFile: vi.fn(),
}));

vi.mock("../../lib/candidates-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/candidates-api")>("../../lib/candidates-api");
  return {
    ...actual,
    getCandidateById: (...args: Parameters<typeof actual.getCandidateById>) => getCandidateByIdMock(...args),
    updateCandidate: (...args: Parameters<typeof actual.updateCandidate>) => updateCandidateMock(...args),
    assignCandidateGroup: (...args: Parameters<typeof actual.assignCandidateGroup>) =>
      assignCandidateGroupMock(...args),
    removeActiveGroupAssignment: (...args: Parameters<typeof actual.removeActiveGroupAssignment>) =>
      removeActiveGroupAssignmentMock(...args),
    deleteCandidate: vi.fn(),
  };
});

vi.mock("../../lib/groups-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/groups-api")>("../../lib/groups-api");
  return {
    ...actual,
    getGroups: (...args: Parameters<typeof actual.getGroups>) => getGroupsMock(...args),
  };
});

vi.mock("../../lib/terms-api", () => ({
  getTerms: vi.fn().mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 200,
    totalCount: 0,
    totalPages: 0,
  }),
  getTermById: vi.fn(),
  createTerm: vi.fn(),
  updateTerm: vi.fn(),
  deleteTerm: vi.fn(),
}));

vi.mock("../../lib/documents-api", () => ({
  getDocumentChecklist: vi.fn().mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 1,
    totalCount: 0,
    totalPages: 1,
  }),
  getDocumentTypes: vi.fn().mockResolvedValue([]),
  getCandidateDocuments: vi.fn().mockResolvedValue([]),
  uploadDocument: vi.fn(),
}));

describe("CandidateDrawer", () => {
  beforeEach(() => {
    getCandidateByIdMock.mockReset();
    updateCandidateMock.mockReset();
    assignCandidateGroupMock.mockReset();
    removeActiveGroupAssignmentMock.mockReset();
    getGroupsMock.mockReset();

    getCandidateByIdMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
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
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    });

    updateCandidateMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
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
      mebSyncStatus: "synced",
      currentGroup: null,
      documentSummary: null,
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:10:00Z",
    });
    assignCandidateGroupMock.mockResolvedValue({
      id: "assignment-1",
      candidateId: "candidate-1",
      groupId: "group-2",
      groupTitle: "2B",
      startDate: "2026-05-05",
      assignedAtUtc: "2026-05-01T10:00:00Z",
      removedAtUtc: null,
      isActive: true,
    });
    removeActiveGroupAssignmentMock.mockResolvedValue(undefined);
    getGroupsMock.mockResolvedValue({ items: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 0 });
  });

  it("saves only canonical english candidate status values", async () => {
    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    await screen.findByRole("heading", { name: "Ada Yilmaz" });

    const statusLabel = screen.getAllByText("Durum").find(
      (node) => node.classList.contains("label")
    );
    const statusRow = statusLabel?.closest(".drawer-row");
    expect(statusRow).not.toBeNull();
    fireEvent.click(statusRow!.querySelector('button[title="Düzenle"]') as HTMLButtonElement);

    const statusSelect = await screen.findByDisplayValue("Aktif");
    fireEvent.change(statusSelect, { target: { value: "graduated" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "candidate-1",
        expect.objectContaining({
          status: "graduated",
        })
      );
    });
  });

  it("saves canonical english gender values and renders the Turkish label", async () => {
    getCandidateByIdMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
      phoneNumber: null,
      email: null,
      birthDate: null,
      // Canonical value from the backend — must render as "Kadın".
      gender: "female",
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
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    await screen.findByRole("heading", { name: "Ada Yilmaz" });

    // Turkish label is rendered for the canonical "female" value.
    expect(screen.getByText("Kadın")).toBeInTheDocument();

    const genderLabel = screen
      .getAllByText("Cinsiyet")
      .find((node) => node.classList.contains("label"));
    const genderRow = genderLabel?.closest(".drawer-row");
    expect(genderRow).not.toBeNull();
    fireEvent.click(
      genderRow!.querySelector('button[title="Düzenle"]') as HTMLButtonElement
    );

    const genderSelect = await screen.findByDisplayValue("Kadın");
    fireEvent.change(genderSelect, { target: { value: "male" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "candidate-1",
        expect.objectContaining({
          gender: "male",
        })
      );
    });
  });

  it("saves canonical meb sync status values", async () => {
    getCandidateByIdMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
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
      mebExamResult: null,
      currentGroup: null,
      documentSummary: null,
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    await screen.findByRole("heading", { name: "Ada Yilmaz" });

    const mebStatusLabel = screen
      .getAllByText("Mebbis")
      .find((node) => node.classList.contains("label"));
    const mebStatusRow = mebStatusLabel?.closest(".drawer-row");
    expect(mebStatusRow).not.toBeNull();
    fireEvent.click(
      mebStatusRow!.querySelector('button[title="Düzenle"]') as HTMLButtonElement
    );

    const mebStatusSelect = await screen.findByDisplayValue("Beklemede");
    fireEvent.change(mebStatusSelect, { target: { value: "synced" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "candidate-1",
        expect.objectContaining({
          mebSyncStatus: "synced",
        })
      );
    });
  });

  it("saves the driving exam date", async () => {
    getCandidateByIdMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
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
      mebExamDate: "2026-05-12",
      drivingExamDate: "2026-06-01",
      mebExamResult: null,
      currentGroup: null,
      documentSummary: null,
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    await screen.findByRole("heading", { name: "Ada Yilmaz" });

    const dateLabel = screen
      .getAllByText("Uygulama Tarihi")
      .find((node) => node.classList.contains("label"));
    const dateRow = dateLabel?.closest(".drawer-row");
    expect(dateRow).not.toBeNull();
    fireEvent.click(
      dateRow!.querySelector('button[title="Düzenle"]') as HTMLButtonElement
    );

    const hiddenDateInput = dateRow!.querySelector(
      'input.localized-date-native-input[type="date"]'
    );
    expect(hiddenDateInput).not.toBeNull();
    fireEvent.change(hiddenDateInput!, {
      target: { value: "2026-06-15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "candidate-1",
        expect.objectContaining({
          drivingExamDate: "2026-06-15",
        })
      );
    });
  });

  it("disables e-sinav date editing after the fourth failed attempt", async () => {
    getCandidateByIdMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
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
      mebExamDate: "2026-06-01",
      mebExamResult: "failed",
      eSinavAttemptCount: 4,
      currentGroup: null,
      documentSummary: null,
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    await screen.findByRole("heading", { name: "Ada Yilmaz" });

    const dateLabel = screen
      .getAllByText("E-Sınav Tarihi")
      .find((node) => node.classList.contains("label"));
    const dateRow = dateLabel?.closest(".drawer-row");
    expect(dateRow).not.toBeNull();

    const editButton = dateRow!.querySelector(
      'button[title="4 hak doldu"]'
    ) as HTMLButtonElement | null;

    expect(editButton).not.toBeNull();
    expect(editButton).toBeDisabled();
  });

  it("saves e-sinav and driving attempt counts as 1..4 values", async () => {
    const candidate = {
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
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
      eSinavAttemptCount: 1,
      drivingExamAttemptCount: 2,
      currentGroup: null,
      documentSummary: null,
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    };
    getCandidateByIdMock.mockResolvedValue(candidate);
    updateCandidateMock.mockImplementation(async (_candidateId, patch) => ({
      ...candidate,
      ...patch,
      updatedAtUtc: "2026-04-12T10:10:00Z",
    }));

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    await screen.findByRole("heading", { name: "Ada Yilmaz" });

    const eSinavLabel = screen
      .getAllByText("E-Sınav Hakkı")
      .find((node) => node.classList.contains("label"));
    const eSinavRow = eSinavLabel?.closest(".drawer-row");
    expect(eSinavRow).not.toBeNull();
    fireEvent.click(
      eSinavRow!.querySelector('button[title="Düzenle"]') as HTMLButtonElement
    );

    const eSinavSelect = eSinavRow!.querySelector(
      "select.custom-select-native"
    ) as HTMLSelectElement | null;
    expect(eSinavSelect).not.toBeNull();
    fireEvent.change(eSinavSelect!, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "candidate-1",
        expect.objectContaining({
          eSinavAttemptCount: 3,
        })
      );
    });

    const drivingLabel = screen
      .getAllByText("Uygulama Hakkı")
      .find((node) => node.classList.contains("label"));
    const drivingRow = drivingLabel?.closest(".drawer-row");
    expect(drivingRow).not.toBeNull();
    fireEvent.click(
      drivingRow!.querySelector('button[title="Düzenle"]') as HTMLButtonElement
    );

    const drivingSelect = drivingRow!.querySelector(
      "select.custom-select-native"
    ) as HTMLSelectElement | null;
    expect(drivingSelect).not.toBeNull();
    fireEvent.change(drivingSelect!, { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "candidate-1",
        expect.objectContaining({
          drivingExamAttemptCount: 4,
        })
      );
    });
  });

  it("renders the group row as group plus term month", async () => {
    getCandidateByIdMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
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
      documentSummary: null,
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    expect(await screen.findByText("NİSAN 2026 / 2 - 1B")).toBeInTheDocument();
  });

  it("assigns the candidate to a selected group from the drawer", async () => {
    const onUpdated = vi.fn();
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
          assignedCandidateCount: 4,
          activeCandidateCount: 4,
          candidatePreview: [],
          startDate: "2026-05-05",
          mebStatus: null,
          createdAtUtc: "2026-04-12T10:00:00Z",
          updatedAtUtc: "2026-04-12T10:00:00Z",
          rowVersion: 1,
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 1,
      totalPages: 1,
    });
    getCandidateByIdMock
      .mockResolvedValueOnce({
        id: "candidate-1",
        firstName: "Ada",
        lastName: "Yilmaz",
        nationalId: "11111111111",
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
        createdAtUtc: "2026-04-12T10:00:00Z",
        updatedAtUtc: "2026-04-12T10:00:00Z",
      })
      .mockResolvedValueOnce({
        id: "candidate-1",
        firstName: "Ada",
        lastName: "Yilmaz",
        nationalId: "11111111111",
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
        currentGroup: {
          groupId: "group-2",
          title: "2B",
          startDate: "2026-05-05",
          term: {
            id: "term-2",
            monthDate: "2026-05-01",
            sequence: 1,
            name: null,
          },
          assignedAtUtc: "2026-05-01T10:00:00Z",
        },
        documentSummary: null,
        createdAtUtc: "2026-04-12T10:00:00Z",
        updatedAtUtc: "2026-04-12T10:10:00Z",
      });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
        onUpdated={onUpdated}
      />
    );

    const groupValue = await screen.findByText("Atanmamış");
    const groupRow = groupValue.closest(".drawer-row") as HTMLElement;
    fireEvent.click(groupRow.querySelector('button[title="Düzenle"]') as HTMLButtonElement);

    await waitFor(() => {
      expect(getGroupsMock).toHaveBeenCalledWith({ pageSize: 100 });
    });
    const groupSelect = groupRow.querySelector("select") as HTMLSelectElement;
    fireEvent.change(groupSelect, { target: { value: "group-2" } });
    fireEvent.click(groupRow.querySelector('button[title="Kaydet"]') as HTMLButtonElement);

    await waitFor(() => {
      expect(assignCandidateGroupMock).toHaveBeenCalledWith("candidate-1", "group-2");
      expect(removeActiveGroupAssignmentMock).not.toHaveBeenCalled();
      expect(onUpdated).toHaveBeenCalled();
    });
  });

  it("removes the active group assignment from the drawer", async () => {
    const onUpdated = vi.fn();
    const candidateWithGroup = {
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
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
      documentSummary: null,
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    };
    getCandidateByIdMock
      .mockResolvedValueOnce(candidateWithGroup)
      .mockResolvedValueOnce({ ...candidateWithGroup, currentGroup: null });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
        onUpdated={onUpdated}
      />
    );

    const groupValue = await screen.findByText("NİSAN 2026 / 2 - 1B");
    const groupRow = groupValue.closest(".drawer-row") as HTMLElement;
    fireEvent.click(groupRow.querySelector('button[title="Düzenle"]') as HTMLButtonElement);

    await waitFor(() => {
      expect(getGroupsMock).toHaveBeenCalledWith({ pageSize: 100 });
    });
    const groupSelect = groupRow.querySelector("select") as HTMLSelectElement;
    fireEvent.change(groupSelect, { target: { value: "" } });
    fireEvent.click(groupRow.querySelector('button[title="Kaydet"]') as HTMLButtonElement);

    await waitFor(() => {
      expect(removeActiveGroupAssignmentMock).toHaveBeenCalledWith("candidate-1");
      expect(assignCandidateGroupMock).not.toHaveBeenCalled();
      expect(onUpdated).toHaveBeenCalled();
    });
  });

  it("renders candidate profile photo in the drawer when available", async () => {
    getCandidateByIdMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
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
      photo: {
        documentId: "doc-1",
        kind: "biometric_photo",
      },
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    const image = await screen.findByRole("img", { name: "Ada Yilmaz" });
    expect(image).toHaveAttribute(
      "src",
      "http://127.0.0.1:5080/api/candidates/candidate-1/documents/doc-1/download"
    );
  });

  it("shows formatted phone number under the name and links it to WhatsApp", async () => {
    getCandidateByIdMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
      phoneNumber: "05321234567",
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
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    const whatsappLink = await screen.findByRole("link", { name: "0 532 123 45 67" });
    expect(whatsappLink).toHaveAttribute("href", "https://wa.me/905321234567");
  });

  it("saves existing license fields as one grouped payload", async () => {
    updateCandidateMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
      phoneNumber: null,
      email: null,
      birthDate: null,
      gender: null,
      licenseClass: "B",
      existingLicenseType: "b_auto",
      existingLicenseIssuedAt: "2018-03-04",
      existingLicenseNumber: "12345",
      existingLicenseIssuedProvince: "Ankara",
      existingLicensePre2016: true,
      status: "active",
      currentGroup: null,
      documentSummary: null,
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:10:00Z",
    });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    await screen.findByRole("heading", { name: "Ada Yilmaz" });
    expect(screen.queryByLabelText("Mevcut Belge")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Mevcut sürücü belgesi var" })
    );
    await waitFor(() => {
      expect(getHiddenSelect("Mevcut Belge")).not.toBeNull();
    });

    const existingLicenseTypeSelect = getHiddenSelect("Mevcut Belge");
    fireEvent.change(existingLicenseTypeSelect!, {
      target: { value: "b_auto" },
    });
    const existingLicenseIssuedAtInput = document.querySelector(
      'input[type="date"]'
    );
    expect(existingLicenseIssuedAtInput).not.toBeNull();
    fireEvent.change(existingLicenseIssuedAtInput!, {
      target: { value: "2018-03-04" },
    });
    fireEvent.change(screen.getByLabelText("Belge No"), {
      target: { value: " 12345 " },
    });

    const existingLicenseProvinceSelect = getHiddenSelect("Belge Veriliş İli");
    expect(existingLicenseProvinceSelect).not.toBeNull();
    fireEvent.change(existingLicenseProvinceSelect!, {
      target: { value: "Ankara" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "2016 Ocak öncesi" }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "candidate-1",
        expect.objectContaining({
          existingLicenseType: "b_auto",
          existingLicenseIssuedAt: "2018-03-04",
          existingLicenseNumber: "12345",
          existingLicenseIssuedProvince: "Ankara",
          existingLicensePre2016: true,
        })
      );
    });
  });
});
