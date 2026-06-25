import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { IntegrationsSettingsSection } from "./IntegrationsSettingsSection";

const getInstitutionIntegrationsMock = vi.fn();
const upsertInstitutionIntegrationsMock = vi.fn();
const checkLocalAgentUpdateMock = vi.fn();
const getLocalAgentHealthMock = vi.fn();
const getLocalAgentUpdateStatusMock = vi.fn();
const pairLocalAgentInMemoryMock = vi.fn();

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

vi.mock("../../lib/local-agent-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/local-agent-api")>(
    "../../lib/local-agent-api"
  );

  return {
    ...actual,
    checkLocalAgentUpdate: (
      ...args: Parameters<typeof actual.checkLocalAgentUpdate>
    ) => checkLocalAgentUpdateMock(...args),
    getLocalAgentHealth: (
      ...args: Parameters<typeof actual.getLocalAgentHealth>
    ) => getLocalAgentHealthMock(...args),
    getLocalAgentUpdateStatus: (
      ...args: Parameters<typeof actual.getLocalAgentUpdateStatus>
    ) => getLocalAgentUpdateStatusMock(...args),
    pairLocalAgentInMemory: (
      ...args: Parameters<typeof actual.pairLocalAgentInMemory>
    ) => pairLocalAgentInMemoryMock(...args),
  };
});

describe("IntegrationsSettingsSection", () => {
  beforeEach(() => {
    vi.useRealTimers();
    getInstitutionIntegrationsMock.mockReset();
    upsertInstitutionIntegrationsMock.mockReset();
    checkLocalAgentUpdateMock.mockReset();
    getLocalAgentHealthMock.mockReset();
    getLocalAgentUpdateStatusMock.mockReset();
    pairLocalAgentInMemoryMock.mockReset();

    getInstitutionIntegrationsMock.mockResolvedValue({
      hasOcrApiKey: true,
      ocrApiKey: "secret-key",
      hasWhatsAppAccessToken: true,
      whatsAppAccessToken: null,
      updatedAtUtc: "2026-01-01T00:00:00Z",
      rowVersion: 4,
    });
    pairLocalAgentInMemoryMock.mockResolvedValue({
      token: "local-agent-token",
      machineName: "Test Machine",
    });
    getLocalAgentHealthMock.mockResolvedValue({
      status: "ok",
      service: "pilot-localagent",
      version: "1.0.0",
      machineName: "Test Machine",
      timestampUtc: "2026-01-01T00:00:00Z",
    });
    checkLocalAgentUpdateMock.mockResolvedValue({
      status: "upToDate",
      currentVersion: "1.0.0",
      availableVersion: "1.0.0",
      message: "Current",
      error: null,
      updatedAtUtc: "2026-01-01T00:00:00Z",
      releaseNotesUrl: "",
      sizeBytes: 123,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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

    fireEvent.click(await screen.findByRole("tab", { name: "OCR" }));

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

    expect(await screen.findByRole("tab", { name: "Downloads" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByAltText("Pilot Agent")).toBeInTheDocument();
    const downloadHref = screen.getByRole("link", { name: "Download" }).getAttribute("href");
    expect(downloadHref).toMatch(
      /^https:\/\/pilotyanimda\.com\/downloads\/localagent\/PilotLocalAgentSetup-win-x64\.exe\?bust=\d+$/
    );
    expect(screen.queryByLabelText("OCR Api key")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Erişim Token")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "OCR" }));

    expect(await screen.findByLabelText("OCR Api key")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "WhatsApp OTP" }));

    expect(await screen.findByLabelText("Erişim Token")).toHaveValue("");
    expect(screen.queryByLabelText("OCR Api key")).not.toBeInTheDocument();
    expect(screen.queryByText("Durum")).not.toBeInTheDocument();
    expect(screen.queryByText("Telefon ID")).not.toBeInTheDocument();
    expect(screen.queryByText("Template Adı")).not.toBeInTheDocument();
    expect(screen.queryByText("Template Dili")).not.toBeInTheDocument();
  });

  it("checks the installed LocalAgent version against the latest release", async () => {
    renderWithProviders(<IntegrationsSettingsSection />);

    fireEvent.click(await screen.findByRole("button", { name: "Güncellemeyi kontrol et" }));

    expect(pairLocalAgentInMemoryMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(checkLocalAgentUpdateMock).toHaveBeenCalledWith("local-agent-token", {
        apiBaseUrl: expect.any(String),
        channel: "stable",
      });
    });
    expect(await screen.findByText("LocalAgent güncel")).toBeInTheDocument();
  });

  it("shows a missing LocalAgent message when pairing fails", async () => {
    pairLocalAgentInMemoryMock.mockRejectedValue(new Error("offline"));

    renderWithProviders(<IntegrationsSettingsSection />);

    fireEvent.click(await screen.findByRole("button", { name: "Güncellemeyi kontrol et" }));

    expect(
      await screen.findByText("LocalAgent çalışmıyor veya kurulu değil.")
    ).toBeInTheDocument();
    expect(checkLocalAgentUpdateMock).not.toHaveBeenCalled();
  });

  it("shows update check start errors separately from missing LocalAgent", async () => {
    checkLocalAgentUpdateMock.mockRejectedValue(new Error("server error"));

    renderWithProviders(<IntegrationsSettingsSection />);

    fireEvent.click(await screen.findByRole("button", { name: "Güncellemeyi kontrol et" }));

    expect(
      await screen.findByText("LocalAgent güncelleme kontrolü başlatılamadı.")
    ).toBeInTheDocument();
  });

  it("polls update status while downloading", async () => {
    checkLocalAgentUpdateMock.mockResolvedValue({
      status: "downloading",
      currentVersion: "1.0.0",
      availableVersion: "1.0.1",
      message: "Downloading",
      error: null,
      updatedAtUtc: "2026-01-01T00:00:00Z",
      releaseNotesUrl: "",
      sizeBytes: 123,
    });
    getLocalAgentUpdateStatusMock.mockResolvedValue({
      status: "pendingIdle",
      currentVersion: "1.0.0",
      availableVersion: "1.0.1",
      message: "Pending idle",
      error: null,
      updatedAtUtc: "2026-01-01T00:00:02Z",
      releaseNotesUrl: "",
      sizeBytes: 123,
    });

    renderWithProviders(<IntegrationsSettingsSection />);

    const button = await screen.findByRole("button", { name: "Güncellemeyi kontrol et" });
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(screen.getByText("Güncelleme indiriliyor...")).toBeInTheDocument();

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(getLocalAgentUpdateStatusMock).toHaveBeenCalledWith("local-agent-token");
    expect(
      screen.getByText("Güncelleme hazır, işlem bitince kurulacak")
    ).toBeInTheDocument();
  });

  it("retries health when status polling fails during an active update", async () => {
    checkLocalAgentUpdateMock.mockResolvedValue({
      status: "downloading",
      currentVersion: "1.0.0",
      availableVersion: "1.0.1",
      message: "Downloading",
      error: null,
      updatedAtUtc: "2026-01-01T00:00:00Z",
      releaseNotesUrl: "",
      sizeBytes: 123,
    });
    getLocalAgentUpdateStatusMock.mockRejectedValue(new Error("agent restarting"));
    getLocalAgentHealthMock.mockResolvedValue({
      status: "ok",
      service: "pilot-localagent",
      version: "1.0.1",
      machineName: "Test Machine",
      timestampUtc: "2026-01-01T00:00:07Z",
    });

    renderWithProviders(<IntegrationsSettingsSection />);

    const button = await screen.findByRole("button", { name: "Güncellemeyi kontrol et" });
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(screen.getByText("Güncelleme indiriliyor...")).toBeInTheDocument();

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(
      screen.getByText("Güncelleme kuruluyor, LocalAgent yeniden başlayacak")
    ).toBeInTheDocument();

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(getLocalAgentHealthMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("LocalAgent güncel")).toBeInTheDocument();
  });
});
