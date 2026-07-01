import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { ReferencesSettingsSection } from "./ReferencesSettingsSection";

const getCandidateReferencesMock = vi.fn();
const createCandidateReferenceMock = vi.fn();
const updateCandidateReferenceMock = vi.fn();
const deleteCandidateReferenceMock = vi.fn();

vi.mock("../../lib/candidate-references-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/candidate-references-api")>(
    "../../lib/candidate-references-api"
  );

  return {
    ...actual,
    getCandidateReferences: (...args: Parameters<typeof actual.getCandidateReferences>) =>
      getCandidateReferencesMock(...args),
    createCandidateReference: (...args: Parameters<typeof actual.createCandidateReference>) =>
      createCandidateReferenceMock(...args),
    updateCandidateReference: (...args: Parameters<typeof actual.updateCandidateReference>) =>
      updateCandidateReferenceMock(...args),
    deleteCandidateReference: (...args: Parameters<typeof actual.deleteCandidateReference>) =>
      deleteCandidateReferenceMock(...args),
  };
});

describe("ReferencesSettingsSection", () => {
  beforeEach(() => {
    getCandidateReferencesMock.mockReset();
    createCandidateReferenceMock.mockReset();
    updateCandidateReferenceMock.mockReset();
    deleteCandidateReferenceMock.mockReset();

    getCandidateReferencesMock.mockResolvedValue([
      {
        id: "ref-1",
        name: "Tavsiye",
        displayOrder: 100,
        isActive: true,
        createdAtUtc: "2026-01-01T00:00:00Z",
        updatedAtUtc: "2026-01-01T00:00:00Z",
        rowVersion: 1,
      },
    ]);
  });

  it("disables reference mutations for candidates view-only users", async () => {
    renderWithProviders(<ReferencesSettingsSection />, {
      auth: {
        user: {
          id: "candidate-viewer",
          phone: "5073737262",
          name: "Candidate Viewer",
          roleName: "Aday İzleme",
          isSuperAdmin: false,
        },
        permissions: { candidates: "view" },
      },
    });

    expect(await screen.findByText("Tavsiye")).toBeInTheDocument();

    const newButton = screen.getByRole("button", { name: "Yeni Referans" });
    expect(newButton).toBeDisabled();
    fireEvent.click(newButton);
    const disabledActions = screen.getAllByTitle("Yetkiniz yok.");
    fireEvent.click(disabledActions[1]);
    fireEvent.click(disabledActions[2]);

    expect(screen.queryByPlaceholderText("Referans adı")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vazgeç" })).not.toBeInTheDocument();
    expect(disabledActions).toHaveLength(3);
    expect(createCandidateReferenceMock).not.toHaveBeenCalled();
    expect(updateCandidateReferenceMock).not.toHaveBeenCalled();
    expect(deleteCandidateReferenceMock).not.toHaveBeenCalled();
  });

  it("loads and creates routes with the route kind", async () => {
    createCandidateReferenceMock.mockResolvedValue({
      id: "route-1",
      kind: "route",
      name: "Sahil",
      displayOrder: 200,
      isActive: true,
      createdAtUtc: "2026-01-01T00:00:00Z",
      updatedAtUtc: "2026-01-01T00:00:00Z",
      rowVersion: 1,
    });

    renderWithProviders(<ReferencesSettingsSection variant="routes" />);

    expect(await screen.findByText("Tavsiye")).toBeInTheDocument();
    expect(getCandidateReferencesMock).toHaveBeenCalledWith(
      { includeInactive: true, kind: "route" },
      expect.any(AbortSignal)
    );

    fireEvent.click(screen.getByRole("button", { name: "Yeni Güzergah" }));
    fireEvent.change(screen.getByPlaceholderText("Güzergah adı"), {
      target: { value: "Sahil" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ekle" }));

    expect(await screen.findByText("Güzergah eklendi")).toBeInTheDocument();
    expect(createCandidateReferenceMock).toHaveBeenCalledWith({
      kind: "route",
      name: "Sahil",
      displayOrder: 200,
      isActive: true,
    });
  });
});
