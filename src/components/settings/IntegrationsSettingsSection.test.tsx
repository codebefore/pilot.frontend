import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { IntegrationsSettingsSection } from "./IntegrationsSettingsSection";

const getInstitutionIntegrationsMock = vi.fn();
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
    upsertInstitutionIntegrations: (
      ...args: Parameters<typeof actual.upsertInstitutionIntegrations>
    ) => upsertInstitutionIntegrationsMock(...args),
  };
});

describe("IntegrationsSettingsSection", () => {
  beforeEach(() => {
    getInstitutionIntegrationsMock.mockReset();
    upsertInstitutionIntegrationsMock.mockReset();

    getInstitutionIntegrationsMock.mockResolvedValue({
      hasOcrApiKey: true,
      ocrApiKey: "secret-key",
      updatedAtUtc: "2026-01-01T00:00:00Z",
      rowVersion: 4,
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
});
