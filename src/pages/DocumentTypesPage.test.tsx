import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentTypesPage } from "./DocumentTypesPage";
import { renderWithProviders } from "../test/render-with-providers";

const getDocumentTypesMock = vi.fn();
const createDocumentTypeMock = vi.fn();
const updateDocumentTypeMock = vi.fn();

vi.mock("../lib/documents-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/documents-api")>(
    "../lib/documents-api"
  );
  return {
    ...actual,
    getDocumentTypes: (...args: Parameters<typeof actual.getDocumentTypes>) =>
      getDocumentTypesMock(...args),
    createDocumentType: (...args: Parameters<typeof actual.createDocumentType>) =>
      createDocumentTypeMock(...args),
    updateDocumentType: (...args: Parameters<typeof actual.updateDocumentType>) =>
      updateDocumentTypeMock(...args),
    // The page itself never calls these, but the modal under test does, so
    // the import must still resolve to something callable.
    getDocumentChecklist: vi.fn(),
    uploadDocument: vi.fn(),
  };
});

const sampleType = {
  id: "t1",
  module: "candidate",
  key: "national_id",
  name: "Nüfus Cüzdanı",
  sortOrder: 0,
  isRequired: true,
  isActive: true,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
};

describe("DocumentTypesPage", () => {
  beforeEach(() => {
    getDocumentTypesMock.mockReset();
    createDocumentTypeMock.mockReset();
    updateDocumentTypeMock.mockReset();

    getDocumentTypesMock.mockResolvedValue([sampleType]);
    createDocumentTypeMock.mockResolvedValue({
      ...sampleType,
      id: "t2",
      key: "health_report",
      name: "Sağlık Raporu",
      sortOrder: 1,
    });
    updateDocumentTypeMock.mockResolvedValue({ ...sampleType, name: "Nüfus" });
  });

  it("loads document types with includeInactive=true on mount", async () => {
    renderWithProviders(<DocumentTypesPage />);

    await waitFor(() => {
      expect(getDocumentTypesMock).toHaveBeenCalledWith(
        { includeInactive: true },
        expect.any(AbortSignal)
      );
    });

    expect(await screen.findByText("national_id")).toBeInTheDocument();
    expect(screen.getByText("Nüfus Cüzdanı")).toBeInTheDocument();
  });

  it("toggles includeInactive and re-fetches", async () => {
    renderWithProviders(<DocumentTypesPage />);
    await waitFor(() => expect(getDocumentTypesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByLabelText("Pasifleri göster"));

    await waitFor(() => {
      expect(getDocumentTypesMock).toHaveBeenLastCalledWith(
        { includeInactive: false },
        expect.any(AbortSignal)
      );
    });
  });

  it("submits canonical english payload when creating", async () => {
    renderWithProviders(<DocumentTypesPage />);
    await waitFor(() => expect(getDocumentTypesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Yeni Belge Türü/i }));

    fireEvent.change(screen.getByPlaceholderText("national_id"), {
      target: { value: "health_report" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nüfus Cüzdanı"), {
      target: { value: "Sağlık Raporu" },
    });
    // Sıra default = items.length last+1 = 1, leave as is.

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createDocumentTypeMock).toHaveBeenCalledWith({
        module: "candidate",
        key: "health_report",
        name: "Sağlık Raporu",
        sortOrder: 1,
        isRequired: true,
        isActive: true,
        metadataFields: [],
      });
    });
  });

  it("submits canonical english payload when editing", async () => {
    renderWithProviders(<DocumentTypesPage />);
    await waitFor(() => expect(screen.getByText("national_id")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Düzenle/i }));

    // Toggle isActive off to verify the boolean is sent raw. The checkbox is
    // wrapped in its <label> so getByLabelText resolves correctly.
    fireEvent.click(screen.getByLabelText("Aktif"));

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateDocumentTypeMock).toHaveBeenCalledWith("t1", {
        module: "candidate",
        key: "national_id",
        name: "Nüfus Cüzdanı",
        sortOrder: 0,
        isRequired: true,
        isActive: false,
        metadataFields: [],
      });
    });
  });
});
