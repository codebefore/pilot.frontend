import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthInstitution } from "../../lib/auth-storage";
import type { LocalAgentMebbisSessionResponse } from "../../lib/local-agent-api";
import { MEBBIS_LIVE_VIEW_STORAGE_KEY } from "../../lib/mebbis-live-view";
import { renderWithProviders } from "../../test/render-with-providers";
import { Header } from "./Header";

const localAgentMocks = vi.hoisted(() => ({
  getLocalAgentHealth: vi.fn(),
  getLocalAgentMebbisSession: vi.fn(),
  openLocalAgentMebbisHomeView: vi.fn(),
  pairLocalAgent: vi.fn(),
  readStoredLocalAgentToken: vi.fn(),
  setLocalAgentMebbisBrowserVisibility: vi.fn(),
  startLocalAgentMebbisSession: vi.fn(),
  stopLocalAgentMebbisSession: vi.fn(),
  submitLocalAgentMebbisVerificationCode: vi.fn(),
}));

const mebbisJobsMocks = vi.hoisted(() => ({
  pairMebbisExtensionClient: vi.fn(),
}));

vi.mock("../../lib/notifications-api", () => ({
  getNotifications: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock("../../lib/local-agent-api", () => ({
  ...localAgentMocks,
  LocalAgentError: class LocalAgentError extends Error {
    status?: number;

    constructor(message: string, status?: number) {
      super(message);
      this.name = "LocalAgentError";
      this.status = status;
    }
  },
}));

vi.mock("../../lib/mebbis-jobs-api", () => ({
  pairMebbisExtensionClient: mebbisJobsMocks.pairMebbisExtensionClient,
}));

const institutions: AuthInstitution[] = [
  {
    id: "i1",
    name: "Pilot Sürücü Kursu",
    roleName: "Kurum Yöneticisi",
    isDefault: true,
    permissions: { dashboard: "view", candidates: "view" },
  },
  {
    id: "i2",
    name: "İkinci Kurum",
    roleName: "Personel",
    isDefault: false,
    permissions: { candidates: "view" },
  },
];

function mebbisSession(
  status: LocalAgentMebbisSessionResponse["status"],
  overrides: Partial<LocalAgentMebbisSessionResponse> = {}
): LocalAgentMebbisSessionResponse {
  return {
    status,
    message: status,
    requiresVerificationCode: status === "waiting_verification",
    updatedAtUtc: "2026-06-22T09:00:00.000Z",
    ...overrides,
  };
}

function renderHeader(
  onInstitutionChange = vi.fn().mockResolvedValue(undefined),
  isSuperAdmin = true
) {
  renderWithProviders(
    <MemoryRouter>
      <Header
        activeInstitutionId="i1"
        institutions={institutions}
        onInstitutionChange={onInstitutionChange}
        onMenuToggle={() => {}}
        onSidebarToggle={() => {}}
        sidebarCollapsed={false}
        userInitials="TU"
      />
    </MemoryRouter>,
    {
      auth: {
        user: {
          id: "header-user",
          phone: "5000000000",
          name: "Header User",
          roleName: isSuperAdmin ? "super_admin" : "Kurum Kullanıcısı",
          isSuperAdmin,
        },
        institutions,
        activeInstitution: institutions[0],
        selectInstitution: onInstitutionChange,
      },
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localAgentMocks.readStoredLocalAgentToken.mockReturnValue(null);
  localAgentMocks.getLocalAgentHealth.mockResolvedValue({
    status: "ok",
    service: "pilot-localagent",
    version: "test",
    machineName: "Test Machine",
    timestampUtc: "2026-06-22T09:00:00.000Z",
  });
  localAgentMocks.getLocalAgentMebbisSession.mockResolvedValue(mebbisSession("inactive"));
  localAgentMocks.openLocalAgentMebbisHomeView.mockResolvedValue({ message: "MEBBİS açıldı" });
  localAgentMocks.pairLocalAgent.mockResolvedValue({
    token: "local-agent-token",
    machineName: "Test Machine",
  });
  localAgentMocks.setLocalAgentMebbisBrowserVisibility.mockResolvedValue({
    visible: true,
    supported: true,
    status: "connected",
    message: "MEBBİS penceresi gösterildi.",
  });
  localAgentMocks.startLocalAgentMebbisSession.mockResolvedValue(mebbisSession("waiting_verification"));
  localAgentMocks.stopLocalAgentMebbisSession.mockResolvedValue(mebbisSession("inactive"));
  localAgentMocks.submitLocalAgentMebbisVerificationCode.mockResolvedValue(mebbisSession("connected"));
  mebbisJobsMocks.pairMebbisExtensionClient.mockResolvedValue({
    id: "extension-client-id",
    displayName: "Pilot LocalAgent - Test Machine",
    apiToken: "extension-token",
  });
});

describe("Header tenant selector", () => {
  it("renders session institutions and calls select handler when changed", async () => {
    const onInstitutionChange = vi.fn().mockResolvedValue(undefined);

    renderHeader(onInstitutionChange);

    fireEvent.click(screen.getByRole("button", { name: "Pilot Sürücü Kursu" }));
    fireEvent.click(screen.getByRole("button", { name: /İkinci Kurum.*Personel/i }));

    await waitFor(() => expect(onInstitutionChange).toHaveBeenCalledWith("i2"));
  });
});

describe("Header language toggle", () => {
  it("shows the language toggle to super admins", () => {
    renderHeader();

    expect(screen.getByRole("button", { name: "Dili değiştir" })).toBeInTheDocument();
  });

  it("hides the language toggle from non-super-admin users", () => {
    renderHeader(vi.fn().mockResolvedValue(undefined), false);

    expect(screen.queryByRole("button", { name: "Dili değiştir" })).not.toBeInTheDocument();
  });
});

describe("Header MEBBİS connection", () => {
  it("always starts a new MEBBİS verification session with live view disabled", async () => {
    localStorage.setItem(MEBBIS_LIVE_VIEW_STORAGE_KEY, "true");

    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "MEBBİS bağlantısı" }));

    await waitFor(() =>
      expect(localAgentMocks.startLocalAgentMebbisSession).toHaveBeenCalledWith(
        expect.objectContaining({ debugVisible: false })
      )
    );
    expect(localStorage.getItem(MEBBIS_LIVE_VIEW_STORAGE_KEY)).toBe("false");
  });

  it("ignores repeated toggle clicks while a start operation is in progress", async () => {
    let resolveStart: (value: LocalAgentMebbisSessionResponse) => void = () => {};
    localAgentMocks.startLocalAgentMebbisSession.mockImplementation(
      () => new Promise<LocalAgentMebbisSessionResponse>((resolve) => {
        resolveStart = resolve;
      })
    );

    renderHeader();

    const toggle = screen.getByRole("button", { name: "MEBBİS bağlantısı" });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    await waitFor(() => expect(localAgentMocks.startLocalAgentMebbisSession).toHaveBeenCalledTimes(1));
    expect(toggle).toBeDisabled();

    resolveStart(mebbisSession("waiting_verification"));

    await screen.findByRole("dialog", { name: "MEBBİS doğrulama kodu" });
  });

  it("opens the verification popover instead of stopping when waiting for code", async () => {
    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "MEBBİS bağlantısı" }));
    await screen.findByRole("dialog", { name: "MEBBİS doğrulama kodu" });

    localAgentMocks.stopLocalAgentMebbisSession.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "MEBBİS bağlantısı" }));

    expect(localAgentMocks.stopLocalAgentMebbisSession).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "MEBBİS doğrulama kodu" })).toBeInTheDocument();
  });

  it("opens MEBBİS from the inline icon without changing the live view preference", async () => {
    renderHeader();

    fireEvent.click(screen.getByTitle("MEBBİS aç"));

    await waitFor(() =>
      expect(localAgentMocks.setLocalAgentMebbisBrowserVisibility).toHaveBeenCalledWith(
        true,
        { persistPreference: false }
      )
    );
    await waitFor(() => expect(localAgentMocks.openLocalAgentMebbisHomeView).toHaveBeenCalledTimes(1));
    expect(localAgentMocks.startLocalAgentMebbisSession).not.toHaveBeenCalled();
    expect(localStorage.getItem(MEBBIS_LIVE_VIEW_STORAGE_KEY)).toBeNull();
  });

  it("makes the active MEBBİS job visible before requesting the home page", async () => {
    let resolveVisibility: (() => void) | undefined;
    localAgentMocks.setLocalAgentMebbisBrowserVisibility.mockImplementation(
      () => new Promise((resolve) => {
        resolveVisibility = () => resolve({
          visible: true,
          supported: true,
          status: "connected",
          message: "MEBBİS penceresi gösterildi.",
        });
      })
    );
    renderHeader();

    fireEvent.click(screen.getByTitle("MEBBİS aç"));

    await waitFor(() =>
      expect(localAgentMocks.setLocalAgentMebbisBrowserVisibility).toHaveBeenCalledWith(
        true,
        { persistPreference: false }
      )
    );
    expect(localAgentMocks.openLocalAgentMebbisHomeView).not.toHaveBeenCalled();

    resolveVisibility?.();

    await waitFor(() => expect(localAgentMocks.openLocalAgentMebbisHomeView).toHaveBeenCalledTimes(1));
  });

  it("hides the live view toggle until MEBBİS is connected", async () => {
    localAgentMocks.readStoredLocalAgentToken.mockReturnValue("local-agent-token");
    localAgentMocks.getLocalAgentMebbisSession.mockResolvedValue(mebbisSession("inactive"));
    renderHeader();

    expect(screen.queryByRole("button", { name: "Canlı İzle" })).not.toBeInTheDocument();
    await waitFor(() => expect(localAgentMocks.getLocalAgentMebbisSession).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Canlı İzle" })).not.toBeInTheDocument();
  });

  it("changes primary MEBBİS browser visibility without restarting the session", async () => {
    localAgentMocks.readStoredLocalAgentToken.mockReturnValue("local-agent-token");
    localAgentMocks.getLocalAgentMebbisSession.mockResolvedValue(mebbisSession("connected"));
    renderHeader();

    const liveViewToggle = await screen.findByRole("button", { name: "Canlı İzle" });
    expect(liveViewToggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(liveViewToggle);

    await waitFor(() => expect(liveViewToggle).toHaveAttribute("aria-pressed", "true"));
    expect(localStorage.getItem(MEBBIS_LIVE_VIEW_STORAGE_KEY)).toBe("true");
    expect(localAgentMocks.setLocalAgentMebbisBrowserVisibility).toHaveBeenLastCalledWith(true);
    expect(localAgentMocks.startLocalAgentMebbisSession).not.toHaveBeenCalled();

    await waitFor(() => expect(liveViewToggle).not.toBeDisabled());

    fireEvent.click(liveViewToggle);

    await waitFor(() => expect(liveViewToggle).toHaveAttribute("aria-pressed", "false"));
    expect(localStorage.getItem(MEBBIS_LIVE_VIEW_STORAGE_KEY)).toBe("false");
    expect(localAgentMocks.setLocalAgentMebbisBrowserVisibility).toHaveBeenLastCalledWith(false);
    expect(localAgentMocks.startLocalAgentMebbisSession).not.toHaveBeenCalled();
  });
});
