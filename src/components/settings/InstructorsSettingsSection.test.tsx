import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/http";
import { renderWithProviders } from "../../test/render-with-providers";
import { InstructorsSettingsSection } from "./InstructorsSettingsSection";

const getInstructorsMock = vi.fn();
const createInstructorMock = vi.fn();
const updateInstructorMock = vi.fn();
const deleteInstructorMock = vi.fn();

vi.mock("../../lib/instructors-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/instructors-api")>(
    "../../lib/instructors-api"
  );

  return {
    ...actual,
    getInstructors: (...args: Parameters<typeof actual.getInstructors>) =>
      getInstructorsMock(...args),
    createInstructor: (...args: Parameters<typeof actual.createInstructor>) =>
      createInstructorMock(...args),
    updateInstructor: (...args: Parameters<typeof actual.updateInstructor>) =>
      updateInstructorMock(...args),
    deleteInstructor: (...args: Parameters<typeof actual.deleteInstructor>) =>
      deleteInstructorMock(...args),
  };
});

const sampleInstructor = {
  id: "i1",
  code: "EGT-0001",
  firstName: "HASAN",
  lastName: "KORKMAZ",
  nationalId: "12345678901",
  phoneNumber: "0532 111 22 33",
  email: "hasan@example.com",
  isActive: true,
  role: "master_instructor" as const,
  employmentType: "hourly" as const,
  branches: ["practice", "traffic"] as const,
  licenseClassCodes: ["B", "A2"] as const,
  weeklyLessonHours: 24,
  mebbisPermitNo: "MEB-123",
  assignedVehicleId: null,
  notes: null,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
  rowVersion: 1,
};

describe("InstructorsSettingsSection", () => {
  beforeEach(() => {
    localStorage.clear();
    getInstructorsMock.mockReset();
    createInstructorMock.mockReset();
    updateInstructorMock.mockReset();
    deleteInstructorMock.mockReset();

    getInstructorsMock.mockResolvedValue({
      items: [sampleInstructor],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
      summary: {
        activeCount: 1,
        masterInstructorCount: 1,
        specialistInstructorCount: 0,
        practiceBranchCount: 1,
      },
    });
    createInstructorMock.mockResolvedValue({
      ...sampleInstructor,
      id: "i2",
      code: "EGT-0002",
      firstName: "AYSE",
      lastName: "DEMIR",
      role: "specialist_instructor",
      employmentType: "salaried",
      branches: ["first_aid"],
      licenseClassCodes: ["B"],
    });
    updateInstructorMock.mockResolvedValue({
      ...sampleInstructor,
      firstName: "MEHMET",
    });
    deleteInstructorMock.mockResolvedValue(undefined);
  });

  it("loads only active instructors on mount", async () => {
    renderWithProviders(<InstructorsSettingsSection />);

    await waitFor(() => {
      expect(getInstructorsMock).toHaveBeenCalledWith(
        { activity: "active", page: 1, pageSize: 10, search: undefined },
        expect.any(AbortSignal)
      );
    });

    expect(await screen.findByText("EGT-0001")).toBeInTheDocument();
    expect(screen.getByText("HASAN KORKMAZ")).toBeInTheDocument();
    expect(screen.getByText("MEBBİS: MEB-123")).toBeInTheDocument();
  });

  it("applies filters and re-fetches", async () => {
    renderWithProviders(<InstructorsSettingsSection />);
    await waitFor(() => expect(getInstructorsMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Genel Durum filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Pasif" }));

    fireEvent.click(screen.getByRole("button", { name: "Görev filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Uzman Öğretici" }));

    fireEvent.click(screen.getByRole("button", { name: "Statü filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Kadrolu" }));

    fireEvent.click(screen.getByRole("button", { name: "Branş filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "İlk Yardım" }));

    fireEvent.click(screen.getByRole("button", { name: "Belge filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: /^A2 -/ }));

    await waitFor(() => {
      expect(getInstructorsMock).toHaveBeenLastCalledWith(
        {
          activity: "inactive",
          role: "specialist_instructor",
          employmentType: "salaried",
          branch: "first_aid",
          licenseClass: "A2",
          page: 1,
          pageSize: 10,
          search: undefined,
        },
        expect.any(AbortSignal)
      );
    });
  });

  it("cycles Kod sorting and resets pagination to page 1", async () => {
    getInstructorsMock.mockResolvedValue({
      items: [sampleInstructor],
      page: 1,
      pageSize: 10,
      totalCount: 11,
      totalPages: 2,
      summary: {
        activeCount: 10,
        masterInstructorCount: 1,
        specialistInstructorCount: 0,
        practiceBranchCount: 1,
      },
    });

    renderWithProviders(<InstructorsSettingsSection />);
    await screen.findByText("EGT-0001");

    fireEvent.click(screen.getByRole("button", { name: /Sonraki/ }));

    await waitFor(() => {
      expect(getInstructorsMock).toHaveBeenLastCalledWith(
        { activity: "active", page: 2, pageSize: 10, search: undefined },
        expect.any(AbortSignal)
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /^Kod/ }));

    await waitFor(() => {
      expect(getInstructorsMock).toHaveBeenLastCalledWith(
        {
          activity: "active",
          page: 1,
          pageSize: 10,
          search: undefined,
          sortBy: "code",
          sortDir: "asc",
        },
        expect.any(AbortSignal)
      );
    });
  });

  it("deletes an instructor with inline confirmation", async () => {
    renderWithProviders(<InstructorsSettingsSection />);
    await screen.findByText("EGT-0001");

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    expect(deleteInstructorMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^Sil$/ }));

    await waitFor(() => {
      expect(deleteInstructorMock).toHaveBeenCalledWith("i1");
    });
  });

  it("submits canonical payload when creating", async () => {
    renderWithProviders(<InstructorsSettingsSection />);
    await waitFor(() => expect(getInstructorsMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Yeni Eğitmen/i }));

    fireEvent.change(screen.getByPlaceholderText("Boş ise otomatik"), {
      target: { value: " egt-0002 " },
    });
    expect(screen.getByPlaceholderText("Boş ise otomatik")).toHaveValue(" EGT-0002 ");
    fireEvent.change(screen.getByPlaceholderText("HASAN"), {
      target: { value: "ayse" },
    });
    expect(screen.getByPlaceholderText("HASAN")).toHaveValue("AYSE");
    fireEvent.change(screen.getByPlaceholderText("KORKMAZ"), {
      target: { value: "demir" },
    });
    expect(screen.getByPlaceholderText("KORKMAZ")).toHaveValue("DEMİR");
    fireEvent.change(screen.getByPlaceholderText("12345678901"), {
      target: { value: "12345678902" },
    });
    fireEvent.change(screen.getByPlaceholderText("24"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByDisplayValue("Usta Öğretici"), {
      target: { value: "specialist_instructor" },
    });
    fireEvent.change(screen.getByDisplayValue("Ders Saat Ücretli"), {
      target: { value: "salaried" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "İlk Yardım" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^A2(?:\s+-)?\s+Motosiklet$/ }));

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createInstructorMock).toHaveBeenCalledWith({
        code: "EGT-0002",
        firstName: "AYSE",
        lastName: "DEMİR",
        nationalId: "12345678902",
        phoneNumber: null,
        email: null,
        isActive: true,
        role: "specialist_instructor",
        employmentType: "salaried",
        branches: ["practice", "first_aid"],
        licenseClassCodes: ["B", "A2"],
        weeklyLessonHours: 30,
        mebbisPermitNo: null,
        assignedVehicleId: null,
        notes: null,
      });
    });
  });

  it("includes rowVersion when updating", async () => {
    renderWithProviders(<InstructorsSettingsSection />);
    await screen.findByText("EGT-0001");

    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    fireEvent.change(screen.getByPlaceholderText("HASAN"), {
      target: { value: "mehmet" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateInstructorMock).toHaveBeenCalledWith("i1", {
        code: "EGT-0001",
        firstName: "MEHMET",
        lastName: "KORKMAZ",
        nationalId: "12345678901",
        phoneNumber: "0532 111 22 33",
        email: "hasan@example.com",
        isActive: true,
        role: "master_instructor",
        employmentType: "hourly",
        branches: ["practice", "traffic"],
        licenseClassCodes: ["B", "A2"],
        weeklyLessonHours: 24,
        mebbisPermitNo: "MEB-123",
        assignedVehicleId: null,
        notes: null,
        rowVersion: 1,
      });
    });
  });

  it("shows unmapped server validation errors as a toast", async () => {
    updateInstructorMock.mockRejectedValueOnce(
      new ApiError(
        400,
        "Bad Request",
        { AssignedVehicleId: ["Assigned vehicle was not found."] },
        {
          AssignedVehicleId: [
            { code: "instructor.validation.invalidAssignedVehicle" },
          ],
        }
      )
    );

    renderWithProviders(<InstructorsSettingsSection />);
    await screen.findByText("EGT-0001");

    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByText("Atanan araç bulunamadı")).toBeInTheDocument();
  });

  it("blocks submit when weekly lesson hours is out of range", async () => {
    renderWithProviders(<InstructorsSettingsSection />);
    await waitFor(() => expect(getInstructorsMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Yeni Eğitmen/i }));
    fireEvent.change(screen.getByPlaceholderText("HASAN"), {
      target: { value: "ayse" },
    });
    fireEvent.change(screen.getByPlaceholderText("KORKMAZ"), {
      target: { value: "demir" },
    });
    fireEvent.change(screen.getByPlaceholderText("24"), {
      target: { value: "81" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(
      await screen.findByText("Haftalık ders saati 0 ile 80 arasında olmalı")
    ).toBeInTheDocument();
    expect(createInstructorMock).not.toHaveBeenCalled();
  });
});
