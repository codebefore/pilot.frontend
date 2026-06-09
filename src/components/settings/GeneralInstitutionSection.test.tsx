import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { GeneralInstitutionSection } from "./GeneralInstitutionSection";

const getInstitutionSettingsMock = vi.fn();
const upsertInstitutionSettingsMock = vi.fn();
const uploadInstitutionLogoMock = vi.fn();
const deleteInstitutionLogoMock = vi.fn();
const getInstitutionLogoObjectUrlMock = vi.fn();

vi.mock("../../lib/institution-settings-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/institution-settings-api")>(
    "../../lib/institution-settings-api"
  );

  return {
    ...actual,
    getInstitutionSettings: (...args: Parameters<typeof actual.getInstitutionSettings>) =>
      getInstitutionSettingsMock(...args),
    upsertInstitutionSettings: (...args: Parameters<typeof actual.upsertInstitutionSettings>) =>
      upsertInstitutionSettingsMock(...args),
    uploadInstitutionLogo: (...args: Parameters<typeof actual.uploadInstitutionLogo>) =>
      uploadInstitutionLogoMock(...args),
    deleteInstitutionLogo: (...args: Parameters<typeof actual.deleteInstitutionLogo>) =>
      deleteInstitutionLogoMock(...args),
    getInstitutionLogoObjectUrl: (
      ...args: Parameters<typeof actual.getInstitutionLogoObjectUrl>
    ) => getInstitutionLogoObjectUrlMock(...args),
  };
});

const institutionSettings = {
  id: "settings-1",
  institutionName: "Pilot Kurs",
  institutionOfficialName: "Pilot Motorlu Taşıt Sürücüleri Kursu",
  institutionCode: "123456",
  institutionAddress: "Adres",
  institutionPhone: "5550000000",
  institutionEmail: null,
  city: null,
  district: null,
  logo: null,
  founder: {
    type: "real" as const,
    name: "Kurucu",
    taxId: "12345678901",
    taxOffice: null,
    address: null,
    phone: null,
  },
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
  rowVersion: 7,
};

describe("GeneralInstitutionSection", () => {
  beforeEach(() => {
    getInstitutionSettingsMock.mockReset();
    upsertInstitutionSettingsMock.mockReset();
    uploadInstitutionLogoMock.mockReset();
    deleteInstitutionLogoMock.mockReset();
    getInstitutionLogoObjectUrlMock.mockReset();

    getInstitutionSettingsMock.mockResolvedValue(institutionSettings);
    upsertInstitutionSettingsMock.mockResolvedValue({
      ...institutionSettings,
      institutionName: "Pilot Kurs Güncel",
      rowVersion: 8,
    });
  });

  it("disables institution setting mutations for settings view-only users", async () => {
    renderWithProviders(<GeneralInstitutionSection />, {
      auth: {
        user: {
          id: "settings-viewer",
          phone: "5073737262",
          name: "Settings Viewer",
          roleName: "Ayar İzleme",
          isSuperAdmin: false,
        },
        permissions: { settings: "view" },
      },
    });

    const nameInput = await screen.findByPlaceholderText("Örn. Pilot Sürücü Kursu");
    expect(nameInput).toBeDisabled();
    expect(nameInput).toHaveValue("Pilot Kurs");

    expect(screen.getByRole("button", { name: "Logo Yükle" })).toBeDisabled();

    const saveButton = screen.getByRole("button", { name: "Kaydet" });
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveAttribute("title", "Yetkiniz yok.");

    fireEvent.submit(saveButton.closest("form")!);
    expect(upsertInstitutionSettingsMock).not.toHaveBeenCalled();
    expect(uploadInstitutionLogoMock).not.toHaveBeenCalled();
    expect(deleteInstitutionLogoMock).not.toHaveBeenCalled();
  });

  it("allows settings full users to save institution changes", async () => {
    renderWithProviders(<GeneralInstitutionSection />, {
      auth: {
        user: {
          id: "settings-manager",
          phone: "5073737262",
          name: "Settings Manager",
          roleName: "Ayar Yönetimi",
          isSuperAdmin: false,
        },
        permissions: { settings: "full" },
      },
    });

    const nameInput = await screen.findByPlaceholderText("Örn. Pilot Sürücü Kursu");
    fireEvent.change(nameInput, { target: { value: "Pilot Kurs Güncel" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(upsertInstitutionSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionName: "Pilot Kurs Güncel",
          rowVersion: 7,
        })
      );
    });
  });

  it("normalizes institution phone input to 10 digits without a leading zero", async () => {
    renderWithProviders(<GeneralInstitutionSection />, {
      auth: {
        user: {
          id: "settings-manager",
          phone: "5073737262",
          name: "Settings Manager",
          roleName: "Ayar Yönetimi",
          isSuperAdmin: false,
        },
        permissions: { settings: "full" },
      },
    });

    const phoneInput = await screen.findByLabelText("Telefon");
    fireEvent.change(phoneInput, { target: { value: "0555 111 22 3344" } });

    expect(phoneInput).toHaveValue("5551112233");

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(upsertInstitutionSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionPhone: "5551112233",
          rowVersion: 7,
        })
      );
    });
  });

});
