import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManageDocumentModal } from "./ManageDocumentModal";
import { renderWithProviders } from "../../test/render-with-providers";

const getCandidateDocumentsMock = vi.fn();
const updateCandidateDocumentMock = vi.fn();
const uploadDocumentMock = vi.fn();

vi.mock("../../lib/documents-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/documents-api")>(
    "../../lib/documents-api"
  );
  return {
    ...actual,
    getCandidateDocuments: (...args: Parameters<typeof actual.getCandidateDocuments>) =>
      getCandidateDocumentsMock(...args),
    updateCandidateDocument: (
      ...args: Parameters<typeof actual.updateCandidateDocument>
    ) => updateCandidateDocumentMock(...args),
    uploadDocument: (...args: Parameters<typeof actual.uploadDocument>) =>
      uploadDocumentMock(...args),
  };
});

describe("ManageDocumentModal", () => {
  beforeEach(() => {
    getCandidateDocumentsMock.mockReset();
    updateCandidateDocumentMock.mockReset();
    uploadDocumentMock.mockReset();
    getCandidateDocumentsMock.mockResolvedValue([
      {
        id: "doc-1",
        candidateId: "cand-1",
        documentTypeId: "type-1",
        documentTypeKey: "health_report",
        documentTypeName: "Sağlık Raporu",
        originalFileName: "rapor.pdf",
        contentType: "application/pdf",
        fileSizeBytes: 2048,
        isPhysicallyAvailable: false,
        hasFile: true,
        note: "Mevcut not",
        metadata: {
          issuing_institution: "Mevcut Kurum",
        },
        uploadedAtUtc: "2026-04-18T08:30:00Z",
        createdAtUtc: "2026-04-18T08:30:00Z",
        updatedAtUtc: "2026-04-18T08:30:00Z",
      },
    ]);
  });

  const documentTypes = [
    {
      id: "type-1",
      module: "candidate",
      key: "health_report",
      name: "Sağlık Raporu",
      sortOrder: 1,
      isRequired: true,
      isActive: true,
      metadataFields: [
        {
          key: "issuing_institution",
          label: "Kurum",
          inputType: "text" as const,
          isRequired: true,
          placeholder: "Kurum adı",
          options: [],
        },
      ],
      createdAtUtc: "2026-01-01T00:00:00Z",
      updatedAtUtc: "2026-01-01T00:00:00Z",
    },
  ];

  function getFileInput() {
    return document.body.querySelector('input[type="file"]') as HTMLInputElement | null;
  }

  it("loads the selected document and shows an open link", async () => {
    renderWithProviders(
      <ManageDocumentModal
        candidateId="cand-1"
        candidateName="Ayse Demir"
        documentTypeId="type-1"
        documentTypes={documentTypes}
        onClose={() => {}}
        onSaved={() => {}}
        open
      />
    );

    expect(await screen.findByDisplayValue("Mevcut Kurum")).toBeInTheDocument();
    expect(screen.getByLabelText("Not")).toHaveValue("Mevcut not");
    expect(screen.getByRole("link", { name: "Belgeyi Aç" })).toHaveAttribute(
      "href",
      "http://127.0.0.1:5080/api/candidates/cand-1/documents/doc-1/download"
    );
    expect(screen.getByRole("button", { name: "Belgeyi Değiştir" })).toBeInTheDocument();
    expect(getFileInput()).not.toBeInTheDocument();
  });

  it("updates note and metadata", async () => {
    updateCandidateDocumentMock.mockResolvedValue({
      id: "doc-1",
    });
    const onSaved = vi.fn();

    renderWithProviders(
      <ManageDocumentModal
        candidateId="cand-1"
        candidateName="Ayse Demir"
        documentTypeId="type-1"
        documentTypes={documentTypes}
        onClose={() => {}}
        onSaved={onSaved}
        open
      />
    );

    await screen.findByDisplayValue("Mevcut Kurum");

    fireEvent.change(screen.getByLabelText("Kurum"), {
      target: { value: "Yeni Kurum" },
    });
    fireEvent.change(screen.getByLabelText("Not"), {
      target: { value: "Yeni not" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCandidateDocumentMock).toHaveBeenCalledWith("cand-1", "doc-1", {
        note: "Yeni not",
        metadata: {
          issuing_institution: "Yeni Kurum",
        },
      });
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
  });

  it("replaces the current file when a new file is selected", async () => {
    uploadDocumentMock.mockResolvedValue({
      id: "doc-2",
    });
    const onSaved = vi.fn();

    renderWithProviders(
      <ManageDocumentModal
        candidateId="cand-1"
        candidateName="Ayse Demir"
        documentTypeId="type-1"
        documentTypes={documentTypes}
        onClose={() => {}}
        onSaved={onSaved}
        open
      />
    );

    await screen.findByDisplayValue("Mevcut Kurum");

    const file = new File(["new-file"], "yeni-rapor.pdf", {
      type: "application/pdf",
    });

    fireEvent.click(screen.getByRole("button", { name: "Belgeyi Değiştir" }));

    expect(getFileInput()).toBeInTheDocument();

    const fileInput = getFileInput() as HTMLInputElement;

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });
    fireEvent.change(screen.getByLabelText("Not"), {
      target: { value: "Yeni dosya notu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(uploadDocumentMock).toHaveBeenCalledWith({
        candidateId: "cand-1",
        documentTypeId: "type-1",
        file,
        note: "Yeni dosya notu",
        metadata: {
          issuing_institution: "Mevcut Kurum",
        },
      });
      expect(updateCandidateDocumentMock).not.toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
  });
});
