import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UploadDocumentModal } from "./UploadDocumentModal";
import { renderWithProviders } from "../../test/render-with-providers";

const uploadDocumentMock = vi.fn();

vi.mock("../../lib/documents-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/documents-api")>(
    "../../lib/documents-api"
  );
  return {
    ...actual,
    uploadDocument: (...args: Parameters<typeof actual.uploadDocument>) =>
      uploadDocumentMock(...args),
  };
});

describe("UploadDocumentModal", () => {
  beforeEach(() => {
    uploadDocumentMock.mockReset();
    uploadDocumentMock.mockResolvedValue({ id: "doc-1" });
  });

  it("applies health report default metadata when uploading from the modal", async () => {
    const onUploaded = vi.fn();
    const documentTypes = [
      {
        id: "type-health",
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

    renderWithProviders(
      <UploadDocumentModal
        candidateId="cand-1"
        candidateName="Ayse Demir"
        documentTypes={documentTypes}
        initialDocumentTypeId="type-health"
        onClose={() => {}}
        onUploaded={onUploaded}
        open
      />
    );

    fireEvent.change(screen.getByLabelText("Kurum"), {
      target: { value: "Aile Hekimi" },
    });
    fireEvent.click(screen.getByLabelText("Fiziksel evrak elde var"));
    fireEvent.click(screen.getByRole("button", { name: "Yükle" }));

    await waitFor(() => {
      expect(uploadDocumentMock).toHaveBeenCalledWith({
        candidateId: "cand-1",
        documentTypeId: "type-health",
        file: null,
        isPhysicallyAvailable: true,
        note: undefined,
        metadata: {
          disability: "none",
          issuing_institution: "Aile Hekimi",
        },
      });
      expect(onUploaded).toHaveBeenCalledTimes(1);
    });
  });

  it("does not submit when opened without manage permission", async () => {
    const onUploaded = vi.fn();
    const documentTypes = [
      {
        id: "type-id",
        module: "candidate",
        key: "national_id",
        name: "Kimlik",
        sortOrder: 1,
        isRequired: true,
        isActive: true,
        metadataFields: [],
        createdAtUtc: "2026-01-01T00:00:00Z",
        updatedAtUtc: "2026-01-01T00:00:00Z",
      },
    ];

    renderWithProviders(
      <UploadDocumentModal
        canManage={false}
        candidateId="cand-1"
        candidateName="Ayse Demir"
        documentTypes={documentTypes}
        initialDocumentTypeId="type-id"
        onClose={() => {}}
        onUploaded={onUploaded}
        open
      />
    );

    const submitButton = screen.getByRole("button", { name: "Yükle" });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveAttribute("title", "Yetkiniz yok.");

    fireEvent.click(screen.getByLabelText("Fiziksel evrak elde var"));
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(uploadDocumentMock).not.toHaveBeenCalled();
      expect(onUploaded).not.toHaveBeenCalled();
    });
  });

  it("shows a file size error before uploading oversized files", async () => {
    const onUploaded = vi.fn();
    const documentTypes = [
      {
        id: "type-webcam",
        module: "candidate",
        key: "webcam_photo",
        name: "Webcam Fotoğrafı",
        sortOrder: 1,
        isRequired: true,
        isActive: true,
        metadataFields: [],
        createdAtUtc: "2026-01-01T00:00:00Z",
        updatedAtUtc: "2026-01-01T00:00:00Z",
      },
    ];
    const oversizedFile = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "webcam.jpg", {
      type: "image/jpeg",
    });

    renderWithProviders(
      <UploadDocumentModal
        candidateId="cand-1"
        candidateName="Ayse Demir"
        documentTypes={documentTypes}
        initialDocumentTypeId="type-webcam"
        onClose={() => {}}
        onUploaded={onUploaded}
        open
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
    fireEvent.click(screen.getByRole("button", { name: "Yükle" }));

    expect(await screen.findByText("Dosya 10 MB'tan büyük olamaz")).toBeInTheDocument();
    expect(uploadDocumentMock).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("keeps file upload enabled when physically available is selected", async () => {
    const onUploaded = vi.fn();
    const documentTypes = [
      {
        id: "type-webcam",
        module: "candidate",
        key: "webcam_photo",
        name: "Webcam Fotoğrafı",
        sortOrder: 1,
        isRequired: true,
        isActive: true,
        metadataFields: [],
        createdAtUtc: "2026-01-01T00:00:00Z",
        updatedAtUtc: "2026-01-01T00:00:00Z",
      },
    ];
    const file = new File(["document"], "document.pdf", { type: "application/pdf" });

    renderWithProviders(
      <UploadDocumentModal
        candidateId="cand-1"
        candidateName="Ayse Demir"
        documentTypes={documentTypes}
        initialDocumentTypeId="type-webcam"
        onClose={() => {}}
        onUploaded={onUploaded}
        open
      />
    );

    fireEvent.click(screen.getByLabelText("Fiziksel evrak elde var"));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Yükle" }));

    await waitFor(() => {
      expect(uploadDocumentMock).toHaveBeenCalledWith({
        candidateId: "cand-1",
        documentTypeId: "type-webcam",
        file,
        isPhysicallyAvailable: true,
        note: undefined,
        metadata: undefined,
      });
      expect(onUploaded).toHaveBeenCalledTimes(1);
    });
  });
});
