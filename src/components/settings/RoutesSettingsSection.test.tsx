import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/http";
import { renderWithProviders } from "../../test/render-with-providers";
import { RoutesSettingsSection } from "./RoutesSettingsSection";

const getRoutesMock = vi.fn();
const createRouteMock = vi.fn();
const updateRouteMock = vi.fn();
const deleteRouteMock = vi.fn();

vi.mock("../../lib/routes-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/routes-api")>(
    "../../lib/routes-api"
  );

  return {
    ...actual,
    getRoutes: (...args: Parameters<typeof actual.getRoutes>) => getRoutesMock(...args),
    createRoute: (...args: Parameters<typeof actual.createRoute>) =>
      createRouteMock(...args),
    updateRoute: (...args: Parameters<typeof actual.updateRoute>) =>
      updateRouteMock(...args),
    deleteRoute: (...args: Parameters<typeof actual.deleteRoute>) =>
      deleteRouteMock(...args),
  };
});

const sampleRoute = {
  id: "r1",
  code: "GZR-01",
  name: "Ümraniye Sınav Güzergahı",
  usageType: "practice_and_exam" as const,
  district: "Ümraniye",
  startLocation: "Kurs önü",
  endLocation: "Sınav alanı",
  distanceKm: 12.5,
  estimatedDurationMinutes: 35,
  isActive: true,
  notes: null,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
  rowVersion: 1,
};

describe("RoutesSettingsSection", () => {
  beforeEach(() => {
    localStorage.clear();
    getRoutesMock.mockReset();
    createRouteMock.mockReset();
    updateRouteMock.mockReset();
    deleteRouteMock.mockReset();

    getRoutesMock.mockResolvedValue({
      items: [sampleRoute],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
      summary: {
        activeCount: 1,
        practiceRouteCount: 1,
        examRouteCount: 1,
      },
    });
    createRouteMock.mockResolvedValue({
      ...sampleRoute,
      id: "r2",
      code: "GZR-02",
      name: "Kadıköy Uygulama",
      usageType: "practice",
    });
    updateRouteMock.mockResolvedValue({
      ...sampleRoute,
      name: "Ümraniye Yeni",
    });
    deleteRouteMock.mockResolvedValue(undefined);
  });

  it("loads only active routes on mount", async () => {
    renderWithProviders(<RoutesSettingsSection />);

    await waitFor(() => {
      expect(getRoutesMock).toHaveBeenCalledWith(
        { activity: "active", page: 1, pageSize: 10, search: undefined },
        expect.any(AbortSignal)
      );
    });

    expect(await screen.findByText("GZR-01")).toBeInTheDocument();
    expect(screen.getByText("Ümraniye Sınav Güzergahı")).toBeInTheDocument();
    expect(screen.getByText("Kurs önü → Sınav alanı")).toBeInTheDocument();
  });

  it("applies filters and re-fetches", async () => {
    renderWithProviders(<RoutesSettingsSection />);
    await waitFor(() => expect(getRoutesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Genel Durum filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Pasif" }));

    fireEvent.click(screen.getByRole("button", { name: "Kullanım filtresi" }));
    fireEvent.click(screen.getByRole("button", { name: "Sınav" }));

    await waitFor(() => {
      expect(getRoutesMock).toHaveBeenLastCalledWith(
        {
          activity: "inactive",
          usageType: "exam",
          page: 1,
          pageSize: 10,
          search: undefined,
        },
        expect.any(AbortSignal)
      );
    });
  });

  it("cycles Kod sorting and resets pagination to page 1", async () => {
    getRoutesMock.mockResolvedValue({
      items: [sampleRoute],
      page: 1,
      pageSize: 10,
      totalCount: 11,
      totalPages: 2,
      summary: {
        activeCount: 10,
        practiceRouteCount: 8,
        examRouteCount: 5,
      },
    });

    renderWithProviders(<RoutesSettingsSection />);
    await screen.findByText("GZR-01");

    fireEvent.click(screen.getByRole("button", { name: /Sonraki/ }));

    await waitFor(() => {
      expect(getRoutesMock).toHaveBeenLastCalledWith(
        { activity: "active", page: 2, pageSize: 10, search: undefined },
        expect.any(AbortSignal)
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /^Kod/ }));

    await waitFor(() => {
      expect(getRoutesMock).toHaveBeenLastCalledWith(
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
    renderWithProviders(<RoutesSettingsSection />);
    await waitFor(() => expect(getRoutesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Yeni Güzergah/i }));

    fireEvent.change(screen.getByPlaceholderText("GZR-01"), {
      target: { value: " gzr-02 " },
    });
    expect(screen.getByPlaceholderText("GZR-01")).toHaveValue(" GZR-02 ");
    fireEvent.change(screen.getByPlaceholderText("Ümraniye Sınav Güzergahı"), {
      target: { value: "Kadıköy Uygulama" },
    });
    fireEvent.change(screen.getByDisplayValue("Ders + Sınav"), {
      target: { value: "practice" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ümraniye"), {
      target: { value: "Kadıköy" },
    });
    fireEvent.change(screen.getByPlaceholderText("Kurs önü"), {
      target: { value: "Kurs çıkışı" },
    });
    fireEvent.change(screen.getByPlaceholderText("Sınav alanı"), {
      target: { value: "Parkur" },
    });
    fireEvent.change(screen.getByPlaceholderText("12.5"), {
      target: { value: "8.5" },
    });
    fireEvent.change(screen.getByPlaceholderText("35"), {
      target: { value: "25" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createRouteMock).toHaveBeenCalledWith({
        code: "GZR-02",
        name: "Kadıköy Uygulama",
        usageType: "practice",
        district: "Kadıköy",
        startLocation: "Kurs çıkışı",
        endLocation: "Parkur",
        distanceKm: 8.5,
        estimatedDurationMinutes: 25,
        isActive: true,
        notes: null,
      });
    });
  });

  it("includes rowVersion when updating", async () => {
    renderWithProviders(<RoutesSettingsSection />);
    await screen.findByText("GZR-01");

    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    fireEvent.change(screen.getByPlaceholderText("Ümraniye Sınav Güzergahı"), {
      target: { value: "Ümraniye Yeni" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateRouteMock).toHaveBeenCalledWith("r1", {
        code: "GZR-01",
        name: "Ümraniye Yeni",
        usageType: "practice_and_exam",
        district: "Ümraniye",
        startLocation: "Kurs önü",
        endLocation: "Sınav alanı",
        distanceKm: 12.5,
        estimatedDurationMinutes: 35,
        isActive: true,
        notes: null,
        rowVersion: 1,
      });
    });
  });

  it("shows unmapped server validation errors as a toast", async () => {
    updateRouteMock.mockRejectedValueOnce(
      new ApiError(
        400,
        "Bad Request",
        { RowVersion: ["Row version is required."] },
        {
          RowVersion: [
            { code: "route.validation.rowVersionRequired" },
          ],
        }
      )
    );

    renderWithProviders(<RoutesSettingsSection />);
    await screen.findByText("GZR-01");

    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByText("Kayıt sürümü zorunlu")).toBeInTheDocument();
  });

  it("deletes a route with inline confirmation", async () => {
    renderWithProviders(<RoutesSettingsSection />);
    await screen.findByText("GZR-01");

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    expect(deleteRouteMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^Sil$/ }));

    await waitFor(() => {
      expect(deleteRouteMock).toHaveBeenCalledWith("r1");
    });
  });
});
