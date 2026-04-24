import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/http";
import { renderWithProviders } from "../../test/render-with-providers";
import { AreasSettingsSection } from "./AreasSettingsSection";

const getAreasMock = vi.fn();
const createAreaMock = vi.fn();
const updateAreaMock = vi.fn();
const deleteAreaMock = vi.fn();

vi.mock("../../lib/areas-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/areas-api")>(
    "../../lib/areas-api"
  );

  return {
    ...actual,
    getAreas: (...args: Parameters<typeof actual.getAreas>) => getAreasMock(...args),
    createArea: (...args: Parameters<typeof actual.createArea>) =>
      createAreaMock(...args),
    updateArea: (...args: Parameters<typeof actual.updateArea>) =>
      updateAreaMock(...args),
    deleteArea: (...args: Parameters<typeof actual.deleteArea>) =>
      deleteAreaMock(...args),
  };
});

const sampleArea = {
  id: "a1",
  code: "SINIF-01",
  name: "Ümraniye Sınıfı",
  areaType: "classroom" as const,
  capacity: 24,
  district: "Ümraniye",
  address: "Merkez şube 2. kat",
  isActive: true,
  notes: null,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
  rowVersion: 1,
};

describe("AreasSettingsSection", () => {
  beforeEach(() => {
    localStorage.clear();
    getAreasMock.mockReset();
    createAreaMock.mockReset();
    updateAreaMock.mockReset();
    deleteAreaMock.mockReset();

    getAreasMock.mockResolvedValue({
      items: [sampleArea],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
      summary: {
        activeCount: 1,
        classroomCount: 1,
        practiceTrackCount: 0,
        examAreaCount: 0,
      },
    });
    createAreaMock.mockResolvedValue({
      ...sampleArea,
      id: "a2",
      code: "SAHA-01",
      name: "Direksiyon Sahası",
      areaType: "practice_track",
    });
    updateAreaMock.mockResolvedValue({
      ...sampleArea,
      name: "Ümraniye Yeni",
    });
    deleteAreaMock.mockResolvedValue(undefined);
  });

  it("loads only active areas on mount", async () => {
    renderWithProviders(<AreasSettingsSection />);

    await waitFor(() => {
      expect(getAreasMock).toHaveBeenCalledWith(
        { activity: "active", page: 1, pageSize: 10, search: undefined },
        expect.any(AbortSignal)
      );
    });

    expect(await screen.findByText("SINIF-01")).toBeInTheDocument();
    expect(screen.getByText("Ümraniye Sınıfı")).toBeInTheDocument();
    expect(screen.getByText("Merkez şube 2. kat")).toBeInTheDocument();
  });

  it("applies filters and re-fetches", async () => {
    renderWithProviders(<AreasSettingsSection />);
    await waitFor(() => expect(getAreasMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Genel Durum filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Pasif" }));

    fireEvent.click(screen.getByRole("button", { name: "Alan Tipi filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Direksiyon Sahası" }));

    await waitFor(() => {
      expect(getAreasMock).toHaveBeenLastCalledWith(
        {
          activity: "inactive",
          areaType: "practice_track",
          page: 1,
          pageSize: 10,
          search: undefined,
        },
        expect.any(AbortSignal)
      );
    });
  });

  it("cycles Kod sorting and resets pagination to page 1", async () => {
    getAreasMock.mockResolvedValue({
      items: [sampleArea],
      page: 1,
      pageSize: 10,
      totalCount: 11,
      totalPages: 2,
      summary: {
        activeCount: 10,
        classroomCount: 5,
        practiceTrackCount: 3,
        examAreaCount: 2,
      },
    });

    renderWithProviders(<AreasSettingsSection />);
    await screen.findByText("SINIF-01");

    fireEvent.click(screen.getByRole("button", { name: /Sonraki/ }));

    await waitFor(() => {
      expect(getAreasMock).toHaveBeenLastCalledWith(
        { activity: "active", page: 2, pageSize: 10, search: undefined },
        expect.any(AbortSignal)
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /^Kod/ }));

    await waitFor(() => {
      expect(getAreasMock).toHaveBeenLastCalledWith(
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

  it("submits canonical payload when creating", async () => {
    renderWithProviders(<AreasSettingsSection />);
    await waitFor(() => expect(getAreasMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Yeni Alan/i }));

    fireEvent.change(screen.getByPlaceholderText("SINIF-01"), {
      target: { value: " saha-01 " },
    });
    expect(screen.getByPlaceholderText("SINIF-01")).toHaveValue(" SAHA-01 ");
    fireEvent.change(screen.getByPlaceholderText("Ümraniye Sınıfı"), {
      target: { value: "Direksiyon Sahası" },
    });
    fireEvent.change(screen.getByDisplayValue("Sınıf"), {
      target: { value: "practice_track" },
    });
    fireEvent.change(screen.getByPlaceholderText("24"), {
      target: { value: "12" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ümraniye"), {
      target: { value: "Kadıköy" },
    });
    fireEvent.change(screen.getByPlaceholderText("Merkez şube 2. kat"), {
      target: { value: "Parkur girişi" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createAreaMock).toHaveBeenCalledWith({
        code: "SAHA-01",
        name: "Direksiyon Sahası",
        areaType: "practice_track",
        capacity: 12,
        district: "Kadıköy",
        address: "Parkur girişi",
        isActive: true,
        notes: null,
      });
    });
  });

  it("includes rowVersion when updating", async () => {
    renderWithProviders(<AreasSettingsSection />);
    await screen.findByText("SINIF-01");

    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    fireEvent.change(screen.getByPlaceholderText("Ümraniye Sınıfı"), {
      target: { value: "Ümraniye Yeni" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateAreaMock).toHaveBeenCalledWith("a1", {
        code: "SINIF-01",
        name: "Ümraniye Yeni",
        areaType: "classroom",
        capacity: 24,
        district: "Ümraniye",
        address: "Merkez şube 2. kat",
        isActive: true,
        notes: null,
        rowVersion: 1,
      });
    });
  });

  it("shows unmapped server validation errors as a toast", async () => {
    updateAreaMock.mockRejectedValueOnce(
      new ApiError(
        400,
        "Bad Request",
        { RowVersion: ["Row version is required."] },
        {
          RowVersion: [
            { code: "area.validation.rowVersionRequired" },
          ],
        }
      )
    );

    renderWithProviders(<AreasSettingsSection />);
    await screen.findByText("SINIF-01");

    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByText("Kayıt sürümü zorunlu")).toBeInTheDocument();
  });

  it("deletes an area with inline confirmation", async () => {
    renderWithProviders(<AreasSettingsSection />);
    await screen.findByText("SINIF-01");

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    expect(deleteAreaMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^Sil$/ }));

    await waitFor(() => {
      expect(deleteAreaMock).toHaveBeenCalledWith("a1");
    });
  });
});
