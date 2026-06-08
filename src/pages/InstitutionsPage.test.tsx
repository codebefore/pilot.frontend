import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InstitutionsPage } from "./InstitutionsPage";
import { renderWithProviders } from "../test/render-with-providers";

const getInstitutionsMock = vi.fn();
const createInstitutionMock = vi.fn();
const updateInstitutionMock = vi.fn();
const createInstitutionFounderMock = vi.fn();
const deleteInstitutionMock = vi.fn();

vi.mock("../lib/institutions-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/institutions-api")>(
    "../lib/institutions-api"
  );
  return {
    ...actual,
    getInstitutions: (...args: Parameters<typeof actual.getInstitutions>) =>
      getInstitutionsMock(...args),
    createInstitution: (...args: Parameters<typeof actual.createInstitution>) =>
      createInstitutionMock(...args),
    updateInstitution: (...args: Parameters<typeof actual.updateInstitution>) =>
      updateInstitutionMock(...args),
    createInstitutionFounder: (...args: Parameters<typeof actual.createInstitutionFounder>) =>
      createInstitutionFounderMock(...args),
    deleteInstitution: (...args: Parameters<typeof actual.deleteInstitution>) =>
      deleteInstitutionMock(...args),
  };
});

const sampleInstitution = {
  id: "institution-1",
  name: "Pilot Sürücü Kursu",
  slug: "pilot-surucu-kursu",
  isActive: true,
  memberCount: 3,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-02T00:00:00Z",
};

describe("InstitutionsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getInstitutionsMock.mockReset();
    createInstitutionMock.mockReset();
    updateInstitutionMock.mockReset();
    createInstitutionFounderMock.mockReset();
    deleteInstitutionMock.mockReset();

    getInstitutionsMock.mockResolvedValue([sampleInstitution]);
    createInstitutionMock.mockResolvedValue({
      institution: {
        ...sampleInstitution,
        id: "institution-2",
        name: "Yeni Kurum",
        slug: "yeni-kurum",
        memberCount: 0,
      },
      firstAdmin: null,
    });
    createInstitutionFounderMock.mockResolvedValue({
      id: "membership-founder",
      userId: "user-founder",
      fullName: "Zekeriyya Sevim",
      phone: "5073737262",
      roleId: "role-founder",
      roleName: "Kurucu",
      isActive: true,
      isDefault: true,
      createdAtUtc: "2026-01-01T00:00:00Z",
      updatedAtUtc: "2026-01-01T00:00:00Z",
    });
    updateInstitutionMock.mockResolvedValue({
      ...sampleInstitution,
      name: "Pilot Güncel",
      isActive: false,
    });
    deleteInstitutionMock.mockResolvedValue(undefined);
  });

  it("loads institutions for super admins", async () => {
    renderWithProviders(<InstitutionsPage />);

    await waitFor(() => {
      expect(getInstitutionsMock).toHaveBeenCalledWith(
        { includeInactive: false },
        expect.any(AbortSignal)
      );
    });

    expect(await screen.findByText("Pilot Sürücü Kursu")).toBeInTheDocument();
    expect(screen.getByText("pilot-surucu-kursu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yeni Kurum" })).toBeInTheDocument();
  });

  it("blocks non-super-admin users", () => {
    renderWithProviders(<InstitutionsPage />, {
      auth: {
        user: {
          id: "manager",
          phone: "5000000001",
          name: "Manager",
          roleName: "Yönetici",
          isSuperAdmin: false,
        },
      },
    });

    expect(screen.getByText("Yetkiniz yok")).toBeInTheDocument();
    expect(getInstitutionsMock).not.toHaveBeenCalled();
  });

  it("creates institutions with founder role and member", async () => {
    renderWithProviders(<InstitutionsPage />);
    await screen.findByText("Pilot Sürücü Kursu");

    fireEvent.click(screen.getByRole("button", { name: "Yeni Kurum" }));
    fireEvent.change(screen.getByLabelText(/Kurum adı/i), {
      target: { value: "Yeni Kurum" },
    });
    fireEvent.change(screen.getByLabelText("Slug"), {
      target: { value: "yeni-kurum" },
    });
    fireEvent.change(screen.getByLabelText(/Ad soyad/i), {
      target: { value: "Zekeriyya Sevim" },
    });
    fireEvent.change(screen.getByLabelText(/Telefon/i), {
      target: { value: "5073737262" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createInstitutionMock).toHaveBeenCalledWith({
        name: "Yeni Kurum",
        slug: "yeni-kurum",
        isActive: true,
      });
    });
    expect(createInstitutionFounderMock).toHaveBeenCalledWith("institution-2", {
      fullName: "Zekeriyya Sevim",
      phone: "5073737262",
      isActive: true,
    });
  });

  it("updates institution active state", async () => {
    renderWithProviders(<InstitutionsPage />);
    await screen.findByText("Pilot Sürücü Kursu");

    fireEvent.click(screen.getByRole("button", { name: /Pilot Sürücü Kursu düzenle/i }));
    fireEvent.click(screen.getByLabelText(/Kurum aktif/i));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateInstitutionMock).toHaveBeenCalledWith("institution-1", {
        name: "Pilot Sürücü Kursu",
        slug: "pilot-surucu-kursu",
        isActive: false,
      });
    });
  });

  it("deactivates institutions after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithProviders(<InstitutionsPage />);
    await screen.findByText("Pilot Sürücü Kursu");

    fireEvent.click(screen.getByRole("button", { name: /Pilot Sürücü Kursu sil/i }));

    await waitFor(() => {
      expect(deleteInstitutionMock).toHaveBeenCalledWith("institution-1", expect.any(Object));
    });
  });
});
