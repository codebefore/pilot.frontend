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
    fireEvent.click(screen.getByLabelText("Fiziksel evrak elde var, dosya yüklemiyorum"));
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

    fireEvent.click(screen.getByLabelText("Fiziksel evrak elde var, dosya yüklemiyorum"));
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(uploadDocumentMock).not.toHaveBeenCalled();
      expect(onUploaded).not.toHaveBeenCalled();
    });
  });
});
