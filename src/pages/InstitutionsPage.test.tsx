import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InstitutionsPage } from "./InstitutionsPage";
import { renderWithProviders } from "../test/render-with-providers";

const getInstitutionsMock = vi.fn();
const createInstitutionMock = vi.fn();
const updateInstitutionMock = vi.fn();
const createInstitutionFounderMock = vi.fn();
const deleteInstitutionMock = vi.fn();
const getInstitutionMembersMock = vi.fn();
const getInstitutionRolesMock = vi.fn();
const lookupInstitutionMemberByPhoneMock = vi.fn();
const lookupInstitutionUserByPhoneMock = vi.fn();
const createInstitutionMemberMock = vi.fn();
const updateInstitutionMemberMock = vi.fn();
const deleteInstitutionMemberMock = vi.fn();

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
    getInstitutionMembers: (...args: Parameters<typeof actual.getInstitutionMembers>) =>
      getInstitutionMembersMock(...args),
    getInstitutionRoles: (...args: Parameters<typeof actual.getInstitutionRoles>) =>
      getInstitutionRolesMock(...args),
    lookupInstitutionMemberByPhone: (
      ...args: Parameters<typeof actual.lookupInstitutionMemberByPhone>
    ) => lookupInstitutionMemberByPhoneMock(...args),
    lookupInstitutionUserByPhone: (
      ...args: Parameters<typeof actual.lookupInstitutionUserByPhone>
    ) => lookupInstitutionUserByPhoneMock(...args),
    createInstitutionMember: (...args: Parameters<typeof actual.createInstitutionMember>) =>
      createInstitutionMemberMock(...args),
    updateInstitutionMember: (...args: Parameters<typeof actual.updateInstitutionMember>) =>
      updateInstitutionMemberMock(...args),
    deleteInstitutionMember: (...args: Parameters<typeof actual.deleteInstitutionMember>) =>
      deleteInstitutionMemberMock(...args),
  };
});

const sampleInstitution = {
  id: "institution-1",
  name: "Pilot Sürücü Kursu",
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
    getInstitutionMembersMock.mockReset();
    getInstitutionRolesMock.mockReset();
    lookupInstitutionMemberByPhoneMock.mockReset();
    lookupInstitutionUserByPhoneMock.mockReset();
    createInstitutionMemberMock.mockReset();
    updateInstitutionMemberMock.mockReset();
    deleteInstitutionMemberMock.mockReset();

    getInstitutionsMock.mockResolvedValue([sampleInstitution]);
    createInstitutionMock.mockResolvedValue({
      institution: {
        ...sampleInstitution,
        id: "institution-2",
        name: "Yeni Kurum",
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
    getInstitutionMembersMock.mockResolvedValue([
      {
        id: "membership-1",
        userId: "user-1",
        fullName: "Zekeriyya Sevim",
        phone: "5073737262",
        roleId: "role-founder",
        roleName: "Kurucu",
        isActive: true,
        isDefault: true,
        createdAtUtc: "2026-01-01T00:00:00Z",
        updatedAtUtc: "2026-01-01T00:00:00Z",
      },
    ]);
    getInstitutionRolesMock.mockResolvedValue([
      {
        id: "role-founder",
        name: "Kurucu",
        isActive: true,
        userCount: 1,
        createdAtUtc: "2026-01-01T00:00:00Z",
        updatedAtUtc: "2026-01-01T00:00:00Z",
      },
      {
        id: "role-manager",
        name: "Yönetici",
        isActive: true,
        userCount: 0,
        createdAtUtc: "2026-01-01T00:00:00Z",
        updatedAtUtc: "2026-01-01T00:00:00Z",
      },
    ]);
    lookupInstitutionMemberByPhoneMock.mockResolvedValue({
      exists: false,
      userId: null,
      fullName: null,
      phone: null,
      isMemberOfInstitution: false,
      membershipId: null,
      membershipIsActive: null,
    });
    lookupInstitutionUserByPhoneMock.mockResolvedValue({
      exists: false,
      userId: null,
      fullName: null,
      phone: null,
      isMemberOfInstitution: false,
      membershipId: null,
      membershipIsActive: null,
    });
    createInstitutionMemberMock.mockResolvedValue({
      id: "membership-2",
      userId: "user-2",
      fullName: "Yeni Üye",
      phone: "5073737263",
      roleId: "role-manager",
      roleName: "Yönetici",
      isActive: true,
      isDefault: false,
      createdAtUtc: "2026-01-01T00:00:00Z",
      updatedAtUtc: "2026-01-01T00:00:00Z",
    });
    updateInstitutionMemberMock.mockResolvedValue({
      id: "membership-1",
      userId: "user-1",
      fullName: "Zekeriyya Sevim",
      phone: "5073737262",
      roleId: "role-manager",
      roleName: "Yönetici",
      isActive: false,
      isDefault: true,
      createdAtUtc: "2026-01-01T00:00:00Z",
      updatedAtUtc: "2026-01-02T00:00:00Z",
    });
    deleteInstitutionMemberMock.mockResolvedValue(undefined);
  });

  it("loads institutions for super admins", async () => {
    renderWithProviders(<InstitutionsPage />);

    await waitFor(() => {
      expect(getInstitutionsMock).toHaveBeenCalledWith(
        { includeInactive: false },
        expect.any(AbortSignal)
      );
    });

    const institutionName = await screen.findByText("Pilot Sürücü Kursu");
    const row = institutionName.closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLTableRowElement).getByText("1")).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText(/Ad soyad/i), {
      target: { value: "Zekeriyya Sevim" },
    });
    fireEvent.change(screen.getByLabelText(/Telefon/i), {
      target: { value: "5073737262" },
    });
    await waitFor(() => {
      expect(lookupInstitutionUserByPhoneMock).toHaveBeenCalledWith(
        "5073737262",
        expect.any(AbortSignal)
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createInstitutionMock).toHaveBeenCalledWith({
        name: "Yeni Kurum",
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

  it("opens members panel and lists institution members", async () => {
    renderWithProviders(<InstitutionsPage />);
    await screen.findByText("Pilot Sürücü Kursu");

    fireEvent.click(screen.getByRole("button", { name: /Pilot Sürücü Kursu üyeler/i }));

    await waitFor(() => {
      expect(getInstitutionMembersMock).toHaveBeenCalledWith(
        "institution-1",
        { includeInactive: true },
        expect.any(AbortSignal)
      );
    });
    expect(await screen.findByText("Zekeriyya Sevim")).toBeInTheDocument();
    expect(getInstitutionRolesMock).toHaveBeenCalledWith(
      "institution-1",
      { includeInactive: false },
      expect.any(AbortSignal)
    );
  });

  it("requires confirmation before linking an existing member to institution", async () => {
    lookupInstitutionMemberByPhoneMock.mockResolvedValue({
      exists: true,
      userId: "user-existing",
      fullName: "Mevcut Kullanıcı",
      phone: "5073737264",
      isMemberOfInstitution: false,
      membershipId: null,
      membershipIsActive: null,
    });
    renderWithProviders(<InstitutionsPage />);
    await screen.findByText("Pilot Sürücü Kursu");
    fireEvent.click(screen.getByRole("button", { name: /Pilot Sürücü Kursu üyeler/i }));
    await screen.findByText("Zekeriyya Sevim");

    fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: "5073737264" } });
    await screen.findByText(/Mevcut Kullanıcı/i);
    fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "role-manager" } });
    fireEvent.click(screen.getByRole("button", { name: "Üye Ekle" }));

    expect(await screen.findByText(/onay verin/i)).toBeInTheDocument();
    expect(createInstitutionMemberMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/Bu kullanıcı bu kuruma eklensin/i));
    fireEvent.click(screen.getByRole("button", { name: "Üye Ekle" }));

    await waitFor(() => {
      expect(createInstitutionMemberMock).toHaveBeenCalledWith("institution-1", {
        fullName: "Mevcut Kullanıcı",
        phone: "5073737264",
        roleId: "role-manager",
        isActive: true,
      });
    });
  });

  it("updates member profile, role and active state", async () => {
    renderWithProviders(<InstitutionsPage />);
    await screen.findByText("Pilot Sürücü Kursu");
    fireEvent.click(screen.getByRole("button", { name: /Pilot Sürücü Kursu üyeler/i }));
    await screen.findByText("Zekeriyya Sevim");

    fireEvent.click(screen.getByRole("button", { name: /Zekeriyya Sevim üyeliğini düzenle/i }));
    fireEvent.change(screen.getByLabelText("Ad soyad"), { target: { value: "Zekeriyya Sevim Güncel" } });
    fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: "5073737265" } });
    fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "role-manager" } });
    fireEvent.click(screen.getByLabelText(/Üyelik aktif/i));
    fireEvent.click(screen.getByRole("button", { name: "Üyeliği Kaydet" }));

    await waitFor(() => {
      expect(updateInstitutionMemberMock).toHaveBeenCalledWith("institution-1", "membership-1", {
        fullName: "Zekeriyya Sevim Güncel",
        phone: "5073737265",
        roleId: "role-manager",
        isActive: false,
      });
    });
  });
});
