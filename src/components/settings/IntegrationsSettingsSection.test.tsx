import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { IntegrationsSettingsSection } from "./IntegrationsSettingsSection";

const getInstitutionIntegrationsMock = vi.fn();
const upsertInstitutionIntegrationsMock = vi.fn();
const sendTestSmsMock = vi.fn();
const getSmsTriggerCatalogMock = vi.fn();
const getSmsTemplatesMock = vi.fn();
const getSmsAutomationRulesMock = vi.fn();
const createSmsTemplateMock = vi.fn();
const updateSmsTemplateMock = vi.fn();
const deleteSmsTemplateMock = vi.fn();
const previewSmsTemplateMock = vi.fn();
const upsertSmsAutomationRuleMock = vi.fn();
const checkLocalAgentUpdateMock = vi.fn();
const getLocalAgentHealthMock = vi.fn();
const getLocalAgentUpdateStatusMock = vi.fn();
const pairLocalAgentInMemoryMock = vi.fn();
const getEInvoiceIntegrationMock = vi.fn();
const upsertEInvoiceIntegrationMock = vi.fn();
const testEInvoiceIntegrationConnectionMock = vi.fn();

vi.mock("../../lib/e-archive-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/e-archive-api")>(
    "../../lib/e-archive-api"
  );

  return {
    ...actual,
    getEInvoiceIntegration: (
      ...args: Parameters<typeof actual.getEInvoiceIntegration>
    ) => getEInvoiceIntegrationMock(...args),
    upsertEInvoiceIntegration: (
      ...args: Parameters<typeof actual.upsertEInvoiceIntegration>
    ) => upsertEInvoiceIntegrationMock(...args),
    testEInvoiceIntegrationConnection: (
      ...args: Parameters<typeof actual.testEInvoiceIntegrationConnection>
    ) => testEInvoiceIntegrationConnectionMock(...args),
  };
});

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
    sendTestSms: (...args: Parameters<typeof actual.sendTestSms>) => sendTestSmsMock(...args),
    getSmsTriggerCatalog: (...args: Parameters<typeof actual.getSmsTriggerCatalog>) =>
      getSmsTriggerCatalogMock(...args),
    getSmsTemplates: (...args: Parameters<typeof actual.getSmsTemplates>) =>
      getSmsTemplatesMock(...args),
    getSmsAutomationRules: (...args: Parameters<typeof actual.getSmsAutomationRules>) =>
      getSmsAutomationRulesMock(...args),
    createSmsTemplate: (...args: Parameters<typeof actual.createSmsTemplate>) =>
      createSmsTemplateMock(...args),
    updateSmsTemplate: (...args: Parameters<typeof actual.updateSmsTemplate>) =>
      updateSmsTemplateMock(...args),
    deleteSmsTemplate: (...args: Parameters<typeof actual.deleteSmsTemplate>) =>
      deleteSmsTemplateMock(...args),
    previewSmsTemplate: (...args: Parameters<typeof actual.previewSmsTemplate>) =>
      previewSmsTemplateMock(...args),
    upsertSmsAutomationRule: (...args: Parameters<typeof actual.upsertSmsAutomationRule>) =>
      upsertSmsAutomationRuleMock(...args),
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
    sendTestSmsMock.mockReset();
    getSmsTriggerCatalogMock.mockReset();
    getSmsTemplatesMock.mockReset();
    getSmsAutomationRulesMock.mockReset();
    createSmsTemplateMock.mockReset();
    updateSmsTemplateMock.mockReset();
    deleteSmsTemplateMock.mockReset();
    previewSmsTemplateMock.mockReset();
    upsertSmsAutomationRuleMock.mockReset();
    checkLocalAgentUpdateMock.mockReset();
    getLocalAgentHealthMock.mockReset();
    getLocalAgentUpdateStatusMock.mockReset();
    pairLocalAgentInMemoryMock.mockReset();
    getEInvoiceIntegrationMock.mockReset();
    upsertEInvoiceIntegrationMock.mockReset();
    testEInvoiceIntegrationConnectionMock.mockReset();

    getInstitutionIntegrationsMock.mockResolvedValue({
      hasOcrApiKey: true,
      ocrApiKey: "secret-key",
      hasWhatsAppAccessToken: true,
      whatsAppAccessToken: null,
      smsProvider: null,
      smsEnabled: false,
      smsSenderTitle: null,
      hasSmsApiToken: false,
      updatedAtUtc: "2026-01-01T00:00:00Z",
      rowVersion: 4,
    });
    getSmsTriggerCatalogMock.mockResolvedValue([
      {
        triggerType: "candidate.created",
        title: "Aday kaydedildi",
        description: "Yeni aday kaydı tamamlandığında çalışır.",
        variables: [
          { key: "candidate.fullName", label: "Aday adı soyadı", exampleValue: "Ayşe Yılmaz" },
        ],
      },
      {
        triggerType: "finance.debt.created",
        title: "Borç eklendi",
        description: "Adaya yeni bir borç kaydı eklendiğinde çalışır.",
        variables: [
          { key: "debt.amount", label: "Borç tutarı", exampleValue: "12.500,00 TL" },
        ],
      },
    ]);
    getSmsTemplatesMock.mockResolvedValue([]);
    getSmsAutomationRulesMock.mockResolvedValue([]);
    previewSmsTemplateMock.mockResolvedValue({
      renderedBody: "Merhaba Ayşe Yılmaz",
      characterCount: 20,
      estimatedSegmentCount: 1,
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
    getEInvoiceIntegrationMock.mockResolvedValue(null);
    upsertEInvoiceIntegrationMock.mockImplementation(async (request) => ({
      providerCode: request.providerCode,
      environment: request.environment,
      taxNumber: request.taxNumber,
      senderAlias: request.senderAlias,
      credentialConfigured: true,
      usesEArchive: request.usesEArchive,
      isEnabled: request.isEnabled,
      createdAtUtc: "2026-07-10T00:00:00Z",
      updatedAtUtc: "2026-07-10T00:00:00Z",
      rowVersion: 1,
    }));
    testEInvoiceIntegrationConnectionMock.mockResolvedValue({
      succeeded: true,
      providerCode: "mysoft",
      environment: "test",
      checkedAtUtc: "2026-07-10T00:00:00Z",
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

  it("shows an institution-scoped e-archive integration tab", async () => {
    getEInvoiceIntegrationMock.mockResolvedValue({
      providerCode: "vendor-one",
      environment: "production",
      taxNumber: "1234567890",
      senderAlias: "urn:mail:defaultpk@institution",
      credentialConfigured: true,
      usesEArchive: true,
      isEnabled: true,
      createdAtUtc: "2026-07-10T00:00:00Z",
      updatedAtUtc: "2026-07-10T00:00:00Z",
      rowVersion: 4,
    });

    renderWithProviders(<IntegrationsSettingsSection />);
    fireEvent.click(await screen.findByRole("tab", { name: "e-Belge" }));

    expect(await screen.findByLabelText("Entegratör Kodu")).toHaveValue("vendor-one");
    expect(screen.getByLabelText("VKN / TCKN")).toHaveValue("1234567890");
    expect(screen.getByLabelText("Gönderici Etiketi")).toHaveValue(
      "urn:mail:defaultpk@institution"
    );
    expect(screen.getByText(/Kimlik bilgileri şifreli olarak kayıtlıdır/)).toBeInTheDocument();
  });

  it("configures the institution's own Kobikom SMS account", async () => {
    upsertInstitutionIntegrationsMock.mockResolvedValue({
      hasOcrApiKey: true,
      ocrApiKey: "secret-key",
      hasWhatsAppAccessToken: true,
      whatsAppAccessToken: null,
      smsProvider: "kobikom",
      smsEnabled: true,
      smsSenderTitle: "KURSUM",
      hasSmsApiToken: true,
      updatedAtUtc: "2026-07-17T00:00:00Z",
      rowVersion: 5,
    });

    renderWithProviders(<IntegrationsSettingsSection />);
    fireEvent.click(await screen.findByRole("tab", { name: "SMS" }));

    expect(screen.getByLabelText("SMS Sağlayıcısı")).toHaveValue("kobikom");
    fireEvent.change(screen.getByLabelText("Gönderici Başlığı"), {
      target: { value: "kursum" },
    });
    fireEvent.change(screen.getByLabelText("API Token"), {
      target: { value: "institution-sms-token" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(upsertInstitutionIntegrationsMock).toHaveBeenCalledWith({
        ocrApiKey: "secret-key",
        clearOcrApiKey: false,
        whatsAppAccessToken: null,
        clearWhatsAppAccessToken: false,
        smsProvider: "kobikom",
        smsEnabled: true,
        smsSenderTitle: "KURSUM",
        smsApiToken: "institution-sms-token",
        clearSmsApiToken: false,
        rowVersion: 4,
      });
    });
    expect(screen.getByLabelText("API Token")).toHaveValue("");
    expect(screen.getByText(/API token kayıtlı/)).toBeInTheDocument();
  });

  it("sends a test SMS from the saved institution Kobikom account", async () => {
    getInstitutionIntegrationsMock.mockResolvedValue({
      hasOcrApiKey: true,
      ocrApiKey: "secret-key",
      hasWhatsAppAccessToken: true,
      whatsAppAccessToken: null,
      smsProvider: "kobikom",
      smsEnabled: true,
      smsSenderTitle: "KURSUM",
      hasSmsApiToken: true,
      updatedAtUtc: "2026-07-17T00:00:00Z",
      rowVersion: 5,
    });
    sendTestSmsMock.mockResolvedValue({
      messageId: "message-1",
      status: "sent",
      phoneMasked: "+90 5** *** 7262",
      providerMessageId: "provider-message-1",
      sentAtUtc: "2026-07-17T00:00:00Z",
    });

    renderWithProviders(<IntegrationsSettingsSection />);
    fireEvent.click(await screen.findByRole("tab", { name: "SMS" }));
    fireEvent.change(screen.getByLabelText("Test telefon numarası"), {
      target: { value: "0507 373 72 62" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Test SMS Gönder" }));

    await waitFor(() => {
      expect(sendTestSmsMock).toHaveBeenCalledWith("0507 373 72 62", expect.any(String));
    });
    expect(screen.getByLabelText("Test telefon numarası")).toHaveValue("");
  });

  it("uses a new request id when retrying a definitely failed test SMS", async () => {
    getInstitutionIntegrationsMock.mockResolvedValue({
      hasOcrApiKey: true,
      ocrApiKey: "secret-key",
      hasWhatsAppAccessToken: true,
      whatsAppAccessToken: null,
      smsProvider: "kobikom",
      smsEnabled: true,
      smsSenderTitle: "KURSUM",
      hasSmsApiToken: true,
      updatedAtUtc: "2026-07-17T00:00:00Z",
      rowVersion: 5,
    });
    sendTestSmsMock
      .mockRejectedValueOnce({ status: 502 })
      .mockResolvedValueOnce({
        messageId: "message-2",
        status: "sent",
        phoneMasked: "+90 5** *** 7262",
        providerMessageId: "provider-message-2",
        sentAtUtc: "2026-07-17T00:00:00Z",
      });

    renderWithProviders(<IntegrationsSettingsSection />);
    fireEvent.click(await screen.findByRole("tab", { name: "SMS" }));
    fireEvent.change(screen.getByLabelText("Test telefon numarası"), {
      target: { value: "0507 373 72 62" },
    });
    const sendButton = screen.getByRole("button", { name: "Test SMS Gönder" });
    fireEvent.click(sendButton);
    await waitFor(() => expect(sendTestSmsMock).toHaveBeenCalledTimes(1));
    const firstRequestId = sendTestSmsMock.mock.calls[0]?.[1];

    fireEvent.click(sendButton);
    await waitFor(() => expect(sendTestSmsMock).toHaveBeenCalledTimes(2));

    expect(sendTestSmsMock.mock.calls[1]?.[1]).not.toBe(firstRequestId);
  });

  it("creates and previews the single automatic SMS template without login triggers", async () => {
    createSmsTemplateMock.mockResolvedValue({
      id: "template-1",
      triggerType: "candidate.created",
      name: "Yeni aday",
      body: "Merhaba {{candidate.fullName}}",
      enabled: true,
      version: 1,
      createdAtUtc: "2026-07-17T00:00:00Z",
      updatedAtUtc: "2026-07-17T00:00:00Z",
      rowVersion: 1,
    });

    renderWithProviders(<IntegrationsSettingsSection />);
    fireEvent.click(await screen.findByRole("tab", { name: "SMS" }));
    expect(screen.queryByRole("tab", { name: "Mesaj Şablonları" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Otomatik Gönderimler" }));

    const templatesSection = (
      await screen.findByRole("heading", { name: "Otomatik Gönderimler" })
    ).closest("section");
    expect(templatesSection).not.toBeNull();
    const templateUi = within(templatesSection!);
    expect(templateUi.getByLabelText("Gönderim olayı")).toHaveValue("candidate.created");
    expect(screen.queryByText(/login/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/OTP fallback/i)).not.toBeInTheDocument();

    fireEvent.change(templateUi.getByLabelText("Mesaj metni"), {
      target: { value: "Merhaba {{candidate.fullName}}" },
    });
    fireEvent.click(templateUi.getByRole("button", { name: "Önizleme" }));
    expect(await templateUi.findByText("Merhaba Ayşe Yılmaz")).toBeInTheDocument();

    fireEvent.click(templateUi.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => {
      expect(createSmsTemplateMock).toHaveBeenCalledWith({
        triggerType: "candidate.created",
        name: "Aday kaydedildi",
        body: "Merhaba {{candidate.fullName}}",
        enabled: true,
        rowVersion: null,
      });
      expect(upsertSmsAutomationRuleMock).toHaveBeenCalledWith("candidate.created", {
        templateId: "template-1",
        timingType: "immediate",
        offsetMinutes: null,
        enabled: false,
        rowVersion: null,
      });
    });
  });

  it("inserts a variable at the cursor in the SMS template editor", async () => {
    renderWithProviders(<IntegrationsSettingsSection />);
    fireEvent.click(await screen.findByRole("tab", { name: "SMS" }));
    fireEvent.click(screen.getByRole("tab", { name: "Otomatik Gönderimler" }));

    const templatesSection = (
      await screen.findByRole("heading", { name: "Otomatik Gönderimler" })
    ).closest("section");
    expect(templatesSection).not.toBeNull();
    const templateUi = within(templatesSection!);
    const editor = templateUi.getByLabelText("Mesaj metni") as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "Merhaba son" } });
    editor.setSelectionRange(8, 8);

    fireEvent.click(templateUi.getByRole("button", { name: "Aday adı soyadı" }));

    expect(editor).toHaveValue("Merhaba {{candidate.fullName}}son");
  });

  it("enables candidate-created SMS automation", async () => {
    getSmsTemplatesMock.mockResolvedValue([
      {
        id: "template-1",
        triggerType: "candidate.created",
        name: "Yeni aday",
        body: "Merhaba {{candidate.fullName}}",
        enabled: true,
        version: 1,
        createdAtUtc: "2026-07-17T00:00:00Z",
        updatedAtUtc: "2026-07-17T00:00:00Z",
        rowVersion: 1,
      },
    ]);
    updateSmsTemplateMock.mockResolvedValue({
      id: "template-1",
      triggerType: "candidate.created",
      name: "Aday kaydedildi",
      body: "Merhaba {{candidate.fullName}}",
      enabled: true,
      version: 1,
      createdAtUtc: "2026-07-17T00:00:00Z",
      updatedAtUtc: "2026-07-20T00:00:00Z",
      rowVersion: 2,
    });
    upsertSmsAutomationRuleMock.mockResolvedValue({
      id: "rule-1",
      triggerType: "candidate.created",
      templateId: "template-1",
      recipientType: "candidate_primary_phone",
      timingType: "immediate",
      offsetMinutes: null,
      enabled: true,
      createdAtUtc: "2026-07-17T00:00:00Z",
      updatedAtUtc: "2026-07-17T00:00:00Z",
      rowVersion: 1,
    });

    renderWithProviders(<IntegrationsSettingsSection />);
    fireEvent.click(await screen.findByRole("tab", { name: "SMS" }));
    fireEvent.click(screen.getByRole("tab", { name: "Otomatik Gönderimler" }));

    const rulesSection = (
      await screen.findByRole("heading", { name: "Otomatik Gönderimler" })
    ).closest("section");
    expect(rulesSection).not.toBeNull();
    const ruleUi = within(rulesSection!);
    expect(ruleUi.getByText(/aynı ekrandan yönetin/)).toBeInTheDocument();
    const toggles = await ruleUi.findAllByRole("checkbox");
    expect(toggles[0]).toBeEnabled();
    fireEvent.click(toggles[0]);
    fireEvent.click(ruleUi.getAllByRole("button", { name: "Kaydet" })[0]);

    await waitFor(() => {
      expect(updateSmsTemplateMock).toHaveBeenCalledWith("template-1", {
        triggerType: "candidate.created",
        name: "Aday kaydedildi",
        body: "Merhaba {{candidate.fullName}}",
        enabled: true,
        rowVersion: 1,
      });
      expect(upsertSmsAutomationRuleMock).toHaveBeenCalledWith("candidate.created", {
        templateId: "template-1",
        timingType: "immediate",
        offsetMinutes: null,
        enabled: true,
        rowVersion: null,
      });
    });
  });

  it("keeps the single passive template linked to its automation rule", async () => {
    getSmsTemplatesMock.mockResolvedValue([
      {
        id: "template-passive",
        triggerType: "candidate.created",
        name: "Eski şablon",
        body: "Merhaba {{candidate.fullName}}",
        enabled: false,
        version: 1,
        createdAtUtc: "2026-07-17T00:00:00Z",
        updatedAtUtc: "2026-07-17T00:00:00Z",
        rowVersion: 2,
      },
    ]);
    getSmsAutomationRulesMock.mockResolvedValue([
      {
        id: "rule-1",
        triggerType: "candidate.created",
        templateId: "template-passive",
        recipientType: "candidate_primary_phone",
        timingType: "immediate",
        offsetMinutes: null,
        enabled: false,
        createdAtUtc: "2026-07-17T00:00:00Z",
        updatedAtUtc: "2026-07-17T00:00:00Z",
        rowVersion: 3,
      },
    ]);
    updateSmsTemplateMock.mockResolvedValue({
      id: "template-passive",
      triggerType: "candidate.created",
      name: "Aday kaydedildi",
      body: "Merhaba {{candidate.fullName}}",
      enabled: true,
      version: 1,
      createdAtUtc: "2026-07-17T00:00:00Z",
      updatedAtUtc: "2026-07-20T00:00:00Z",
      rowVersion: 3,
    });

    renderWithProviders(<IntegrationsSettingsSection />);
    fireEvent.click(await screen.findByRole("tab", { name: "SMS" }));
    fireEvent.click(screen.getByRole("tab", { name: "Otomatik Gönderimler" }));

    const rulesSection = (
      await screen.findByRole("heading", { name: "Otomatik Gönderimler" })
    ).closest("section");
    expect(rulesSection).not.toBeNull();
    const ruleUi = within(rulesSection!);
    expect(ruleUi.getByLabelText("Mesaj metni")).toHaveValue(
      "Merhaba {{candidate.fullName}}",
    );
    fireEvent.click(ruleUi.getAllByRole("button", { name: "Kaydet" })[0]);

    await waitFor(() => {
      expect(updateSmsTemplateMock).toHaveBeenCalledWith("template-passive", {
        triggerType: "candidate.created",
        name: "Aday kaydedildi",
        body: "Merhaba {{candidate.fullName}}",
        enabled: true,
        rowVersion: 2,
      });
      expect(upsertSmsAutomationRuleMock).toHaveBeenCalledWith("candidate.created", {
        templateId: "template-passive",
        timingType: "immediate",
        offsetMinutes: null,
        enabled: false,
        rowVersion: 3,
      });
    });
  });

  it("shows provider fields when no integration is configured", async () => {
    renderWithProviders(<IntegrationsSettingsSection />);
    fireEvent.click(await screen.findByRole("tab", { name: "e-Belge" }));

    expect(screen.queryByText("e-Arşiv kullanılacak")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Entegratör Kodu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeInTheDocument();
    expect(upsertEInvoiceIntegrationMock).not.toHaveBeenCalled();
  });

  it("automatically saves when an existing e-archive integration is turned off", async () => {
    getEInvoiceIntegrationMock.mockResolvedValue({
      providerCode: "vendor-one",
      environment: "production",
      taxNumber: "1234567890",
      senderAlias: "urn:mail:defaultpk@institution",
      credentialConfigured: true,
      usesEArchive: true,
      isEnabled: true,
      createdAtUtc: "2026-07-10T00:00:00Z",
      updatedAtUtc: "2026-07-10T00:00:00Z",
      rowVersion: 4,
    });
    renderWithProviders(<IntegrationsSettingsSection />);
    fireEvent.click(await screen.findByRole("tab", { name: "e-Belge" }));

    fireEvent.click(await screen.findByRole("button", { name: "Entegrasyonu Pasifleştir" }));

    await waitFor(() => {
      expect(upsertEInvoiceIntegrationMock).toHaveBeenCalledWith({
        providerCode: "vendor-one",
        environment: "production",
        taxNumber: "1234567890",
        senderAlias: "urn:mail:defaultpk@institution",
        username: null,
        password: null,
        connectorGuid: null,
        usesEArchive: true,
        isEnabled: false,
        rowVersion: 4,
      });
    });
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeInTheDocument();
  });

  it("tests the saved MySoft connection without exposing credentials", async () => {
    getEInvoiceIntegrationMock.mockResolvedValue({
      providerCode: "mysoft",
      environment: "test",
      taxNumber: "1234567890",
      senderAlias: null,
      credentialConfigured: true,
      usesEArchive: true,
      isEnabled: true,
      createdAtUtc: "2026-07-10T00:00:00Z",
      updatedAtUtc: "2026-07-10T00:00:00Z",
      rowVersion: 2,
    });
    renderWithProviders(<IntegrationsSettingsSection />);
    fireEvent.click(await screen.findByRole("tab", { name: "e-Belge" }));

    fireEvent.click(await screen.findByRole("button", { name: "Bağlantıyı Test Et" }));

    await waitFor(() => {
      expect(testEInvoiceIntegrationConnectionMock).toHaveBeenCalledTimes(1);
    });
  });

  it("validates and saves e-archive integration details", async () => {
    renderWithProviders(<IntegrationsSettingsSection />);
    fireEvent.click(await screen.findByRole("tab", { name: "e-Belge" }));

    fireEvent.change(await screen.findByLabelText("Entegratör Kodu"), {
      target: { value: "vendor-one" },
    });
    fireEvent.change(screen.getByLabelText("VKN / TCKN"), {
      target: { value: "1234567890" },
    });
    fireEvent.change(screen.getByLabelText("Gönderici Etiketi"), {
      target: { value: "urn:mail:defaultpk@institution" },
    });
    fireEvent.change(screen.getByLabelText("Entegratör Kullanıcı Adı"), {
      target: { value: "institution-user" },
    });
    fireEvent.change(screen.getByLabelText("Entegratör Şifresi"), {
      target: { value: "institution-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(upsertEInvoiceIntegrationMock).toHaveBeenCalledWith({
        providerCode: "vendor-one",
        environment: "test",
        taxNumber: "1234567890",
        senderAlias: "urn:mail:defaultpk@institution",
        username: "institution-user",
        password: "institution-password",
        connectorGuid: null,
        usesEArchive: true,
        isEnabled: true,
        rowVersion: null,
      });
    });
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
