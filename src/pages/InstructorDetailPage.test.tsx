import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { InstructorDetailPage } from "./InstructorDetailPage";

const getInstructorMock = vi.fn();
const markInstructorLeftMock = vi.fn();
const clearInstructorLeftMock = vi.fn();
const listAssignmentsMock = vi.fn();
const deleteAssignmentMock = vi.fn();
const deleteAssignmentDocumentMock = vi.fn();
const getTrainingBranchDefinitionsMock = vi.fn();

vi.mock("../lib/instructors-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/instructors-api")>(
    "../lib/instructors-api"
  );

  return {
    ...actual,
    getInstructor: (...args: Parameters<typeof actual.getInstructor>) =>
      getInstructorMock(...args),
    markInstructorLeft: (...args: Parameters<typeof actual.markInstructorLeft>) =>
      markInstructorLeftMock(...args),
    clearInstructorLeft: (...args: Parameters<typeof actual.clearInstructorLeft>) =>
      clearInstructorLeftMock(...args),
  };
});

vi.mock("../lib/instructor-assignments-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/instructor-assignments-api")>(
    "../lib/instructor-assignments-api"
  );

  return {
    ...actual,
    listAssignments: (...args: Parameters<typeof actual.listAssignments>) =>
      listAssignmentsMock(...args),
    deleteAssignment: (...args: Parameters<typeof actual.deleteAssignment>) =>
      deleteAssignmentMock(...args),
    deleteAssignmentDocument: (
      ...args: Parameters<typeof actual.deleteAssignmentDocument>
    ) => deleteAssignmentDocumentMock(...args),
  };
});

vi.mock("../lib/training-branch-definitions-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/training-branch-definitions-api")>(
    "../lib/training-branch-definitions-api"
  );

  return {
    ...actual,
    getTrainingBranchDefinitions: (
      ...args: Parameters<typeof actual.getTrainingBranchDefinitions>
    ) => getTrainingBranchDefinitionsMock(...args),
  };
});

const instructor = {
  id: "i1",
  firstName: "HASAN",
  lastName: "KORKMAZ",
  nationalId: "20000000114",
  driverLicenseNumber: "DL-12345",
  driverLicenseTypeText: "B",
  driverLicenseIssuedPlace: "Kadıköy",
  driverLicenseAddress: "Caferağa Mah. Kadıköy",
  phoneNumber: "5321112233",
  email: null,
  isActive: true,
  role: "master_instructor" as const,
  employmentType: "hourly" as const,
  branches: ["practice"],
  licenseClassCodes: ["B"] as const,
  weeklyLessonHours: 24,
  mebbisPermitNo: "MEB-123",
  contractStartDate: "2026-01-01",
  contractEndDate: null,
  assignedVehicleId: null,
  notes: null,
  hasPhoto: false,
  leftAtDate: null,
  leaveReason: null,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
  rowVersion: 1,
};

const assignment = {
  id: "a1",
  instructorId: "i1",
  sequenceNumber: 1,
  role: "master_instructor" as const,
  employmentType: "hourly" as const,
  branches: ["practice"],
  licenseClassCodes: ["B"] as const,
  weeklyLessonHours: 24,
  mebPermitNo: "MEB-123",
  contractStartDate: "2026-01-01",
  contractEndDate: null,
  documents: [
    {
      id: "d1",
      name: "Sözleşme",
      description: null,
      originalFileName: "sozlesme.pdf",
      contentType: "application/pdf",
      fileSizeBytes: 1024,
      uploadedAtUtc: "2026-01-01T00:00:00Z",
    },
  ],
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
  rowVersion: 1,
};

function renderPage(auth?: NonNullable<Parameters<typeof renderWithProviders>[1]>["auth"]) {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/settings/definitions/instructors/i1"]}>
      <Routes>
        <Route
          element={<InstructorDetailPage />}
          path="/settings/definitions/instructors/:instructorId"
        />
      </Routes>
    </MemoryRouter>,
    { auth }
  );
}

describe("InstructorDetailPage permissions", () => {
  beforeEach(() => {
    getInstructorMock.mockReset();
    markInstructorLeftMock.mockReset();
    clearInstructorLeftMock.mockReset();
    listAssignmentsMock.mockReset();
    deleteAssignmentMock.mockReset();
    deleteAssignmentDocumentMock.mockReset();
    getTrainingBranchDefinitionsMock.mockReset();

    getInstructorMock.mockResolvedValue(instructor);
    listAssignmentsMock.mockResolvedValue([assignment]);
    getTrainingBranchDefinitionsMock.mockResolvedValue({
      items: [
        {
          id: "branch-practice",
          code: "practice",
          name: "Direksiyon",
          totalLessonHourLimit: null,
          colorHex: "#3e5660",
          displayOrder: 10,
          isActive: true,
          notes: null,
          createdAtUtc: "2026-01-01T00:00:00Z",
          updatedAtUtc: "2026-01-01T00:00:00Z",
          rowVersion: 1,
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 1,
      totalPages: 1,
      summary: {
        activeCount: 1,
        limitedCount: 0,
      },
    });
  });

  it("disables assignment and document mutations for view-only users", async () => {
    renderPage({
      user: {
        id: "readonly-user",
        phone: "5000000001",
        name: "Read Only",
        roleName: "Eğitim",
        isSuperAdmin: false,
      },
      permissions: { training: "view", documents: "view" },
    });

    await waitFor(() => expect(getInstructorMock).toHaveBeenCalledWith("i1", expect.any(AbortSignal)));
    expect(await screen.findByText("HASAN KORKMAZ")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "İşten Ayrıldı" })).toBeDisabled();
    const addAssignmentButton = screen.getByRole("button", { name: /Atama Ekle/i });
    const editButton = screen.getByRole("button", { name: "Düzenle" });
    const deleteAssignmentButton = screen.getAllByRole("button", { name: "Sil" })[0];
    const addDocumentButton = screen.getByRole("button", { name: /Evrak Ekle/i });

    expect(addAssignmentButton).toBeDisabled();
    expect(editButton).toBeDisabled();
    expect(deleteAssignmentButton).toBeDisabled();
    expect(addDocumentButton).toBeDisabled();

    for (const button of [
      screen.getByRole("button", { name: "İşten Ayrıldı" }),
      addAssignmentButton,
      editButton,
      deleteAssignmentButton,
      addDocumentButton,
    ]) {
      fireEvent.click(button);
    }

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(markInstructorLeftMock).not.toHaveBeenCalled();
    expect(deleteAssignmentMock).not.toHaveBeenCalled();
    expect(deleteAssignmentDocumentMock).not.toHaveBeenCalled();
  });
});
