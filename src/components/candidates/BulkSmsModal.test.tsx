import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { BulkSmsModal } from "./BulkSmsModal";

const getTemplatesMock = vi.fn();
const getCatalogMock = vi.fn();
const createTemplateMock = vi.fn();
const previewTemplateMock = vi.fn();
const sendBulkMock = vi.fn();

vi.mock("../../lib/institution-settings-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/institution-settings-api")>(
    "../../lib/institution-settings-api"
  );
  return {
    ...actual,
    getSmsBulkTemplates: (...args: Parameters<typeof actual.getSmsBulkTemplates>) => getTemplatesMock(...args),
    getSmsBulkCatalog: (...args: Parameters<typeof actual.getSmsBulkCatalog>) => getCatalogMock(...args),
    createSmsBulkTemplate: (...args: Parameters<typeof actual.createSmsBulkTemplate>) => createTemplateMock(...args),
    previewSmsBulkTemplate: (...args: Parameters<typeof actual.previewSmsBulkTemplate>) => previewTemplateMock(...args),
    sendSmsBulk: (...args: Parameters<typeof actual.sendSmsBulk>) => sendBulkMock(...args),
  };
});

describe("BulkSmsModal", () => {
  beforeEach(() => {
    getTemplatesMock.mockReset().mockResolvedValue([]);
    getCatalogMock.mockReset().mockResolvedValue({
      variables: [{ key: "candidate.fullName", label: "Aday adı soyadı", exampleValue: "Ayşe Yılmaz" }],
    });
    createTemplateMock.mockReset().mockResolvedValue({
      id: "template-1",
      name: "Duyuru",
      body: "Merhaba {{candidate.fullName}}",
      version: 1,
      createdAtUtc: "2026-07-20T00:00:00Z",
      updatedAtUtc: "2026-07-20T00:00:00Z",
      rowVersion: 1,
    });
    previewTemplateMock.mockReset().mockResolvedValue({
      renderedBody: "Merhaba Ayşe Yılmaz",
      characterCount: 20,
      estimatedSegmentCount: 1,
    });
    sendBulkMock.mockReset().mockResolvedValue({
      requestId: "request-1",
      requestedCount: 2,
      queuedCount: 2,
      skippedCount: 0,
      alreadyQueued: false,
    });
  });

  it("creates a reusable template before queueing selected candidates", async () => {
    const onSent = vi.fn();
    renderWithProviders(
      <BulkSmsModal
        candidateIds={["candidate-1", "candidate-2"]}
        onClose={() => {}}
        onSent={onSent}
        open
      />
    );

    fireEvent.change(await screen.findByLabelText("Şablon adı"), { target: { value: "Duyuru" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Mesaj" }), {
      target: { value: "Merhaba {{candidate.fullName}}" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Şablonu kaydet" }));

    await waitFor(() => expect(createTemplateMock).toHaveBeenCalledWith(
      "Duyuru",
      "Merhaba {{candidate.fullName}}"
    ));
    fireEvent.click(screen.getByRole("button", { name: "SMS’leri kuyruğa al" }));

    await waitFor(() => expect(sendBulkMock).toHaveBeenCalledWith(
      ["candidate-1", "candidate-2"],
      "template-1",
      expect.any(String)
    ));
    expect(onSent).toHaveBeenCalledWith(2, 0);
  });

  it("does not show a load error when the initial request is cancelled", async () => {
    getTemplatesMock.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));

    renderWithProviders(
      <BulkSmsModal
        candidateIds={["candidate-1"]}
        onClose={() => {}}
        onSent={() => {}}
        open
      />
    );

    await screen.findByRole("option", { name: "Yeni şablon oluştur" });
    expect(screen.queryByText("Toplu SMS şablonları yüklenemedi.")).not.toBeInTheDocument();
  });

  it("shows supported variables when the catalog response is empty", async () => {
    getCatalogMock.mockResolvedValueOnce({ variables: [] });

    renderWithProviders(
      <BulkSmsModal
        candidateIds={["candidate-1"]}
        onClose={() => {}}
        onSent={() => {}}
        open
      />
    );

    expect(await screen.findByRole("button", { name: /Aday adı soyadı/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kurum adı/ })).toBeInTheDocument();
  });

  it("reuses the request id when a send response fails", async () => {
    getTemplatesMock.mockResolvedValue([{
      id: "template-1",
      name: "Duyuru",
      body: "Merhaba {{candidate.fullName}}",
      version: 1,
      createdAtUtc: "2026-07-20T00:00:00Z",
      updatedAtUtc: "2026-07-20T00:00:00Z",
      rowVersion: 1,
    }]);
    sendBulkMock
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce({
        requestId: "request-1",
        requestedCount: 1,
        queuedCount: 1,
        skippedCount: 0,
        alreadyQueued: true,
      });

    renderWithProviders(
      <BulkSmsModal
        candidateIds={["candidate-1"]}
        onClose={() => {}}
        onSent={() => {}}
        open
      />
    );

    const sendButton = await screen.findByRole("button", { name: "SMS’leri kuyruğa al" });
    fireEvent.click(sendButton);
    await screen.findByText("Toplu SMS kuyruğa alınamadı. SMS entegrasyonunun aktif olduğunu kontrol edin.");
    fireEvent.click(sendButton);

    await waitFor(() => expect(sendBulkMock).toHaveBeenCalledTimes(2));
    expect(sendBulkMock.mock.calls[0][2]).toBe(sendBulkMock.mock.calls[1][2]);
  });
});
