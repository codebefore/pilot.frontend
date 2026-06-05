import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { IntegrationsSettingsSection } from "./IntegrationsSettingsSection";

const getInstitutionIntegrationsMock = vi.fn();
const getWhatsAppStatusMock = vi.fn();
const upsertInstitutionIntegrationsMock = vi.fn();

vi.mock("../../lib/institution-settings-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/institution-settings-api")>(
    "../../lib/institution-settings-api"
  );

  return {
    ...actual,
    getInstitutionIntegrations: (
      ...args: Parameters<typeof actual.getInstitutionIntegrations>
    ) => getInstitutionIntegrationsMock(...args),
    getWhatsAppStatus: (
      ...args: Parameters<typeof actual.getWhatsAppStatus>
    ) => getWhatsAppStatusMock(...args),
    upsertInstitutionIntegrations: (
      ...args: Parameters<typeof actual.upsertInstitutionIntegrations>
    ) => upsertInstitutionIntegrationsMock(...args),
  };
});

describe("IntegrationsSettingsSection", () => {
  beforeEach(() => {
    getInstitutionIntegrationsMock.mockReset();
    getWhatsAppStatusMock.mockReset();
    upsertInstitutionIntegrationsMock.mockReset();

    getInstitutionIntegrationsMock.mockResolvedValue({
      hasOcrApiKey: true,
      ocrApiKey: "secret-key",
      hasWhatsAppAccessToken: true,
      whatsAppAccessToken: null,
      updatedAtUtc: "2026-01-01T00:00:00Z",
      rowVersion: 4,
    });
    getWhatsAppStatusMock.mockResolvedValue({
      enabled: true,
      hasPhoneNumberId: true,
      hasAccessToken: true,
      templateName: "login_code",
      templateLanguage: "tr",
    });
  });

  it("disables integration saves without settings full permission", async () => {
    renderWithProviders(<IntegrationsSettingsSection />, {
      auth: {
        user: {
          id: "meb-viewer",
          phone: "5073737262",
          name: "Meb Viewer",
          roleName: "MEBBIS",
          isSuperAdmin: false,
        },
        permissions: { settings: "view", mebjobs: "full" },
      },
    });

    const input = await screen.findByLabelText("OCR Api key");
    expect(input).toBeDisabled();
    expect(input).toHaveValue("secret-key");

    const saveButton = screen.getByRole("button", { name: "Kaydet" });
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveAttribute("title", "Yetkiniz yok.");

    fireEvent.submit(saveButton.closest("form")!);
    expect(upsertInstitutionIntegrationsMock).not.toHaveBeenCalled();
  });

  it("shows integrations as tabs and switches to WhatsApp settings", async () => {
    renderWithProviders(<IntegrationsSettingsSection />);

    expect(await screen.findByLabelText("OCR Api key")).toBeInTheDocument();
    expect(screen.queryByLabelText("Erişim Token")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "WhatsApp OTP" }));

    expect(await screen.findByLabelText("Erişim Token")).toHaveValue("");
    expect(screen.queryByLabelText("OCR Api key")).not.toBeInTheDocument();
    expect(screen.getByText("login_code")).toBeInTheDocument();
  });
});
