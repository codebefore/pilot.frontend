import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CandidateNotesPanel } from "./CandidateNotesPanel";
import { renderWithProviders } from "../../test/render-with-providers";

const getCandidateNotesMock = vi.fn();
const createCandidateNoteMock = vi.fn();
const setCandidateNoteCompletionMock = vi.fn();
const deleteCandidateNoteMock = vi.fn();

vi.mock("../../lib/candidate-notes-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/candidate-notes-api")>(
    "../../lib/candidate-notes-api"
  );
  return {
    ...actual,
    getCandidateNotes: (...args: Parameters<typeof actual.getCandidateNotes>) =>
      getCandidateNotesMock(...args),
    createCandidateNote: (...args: Parameters<typeof actual.createCandidateNote>) =>
      createCandidateNoteMock(...args),
    setCandidateNoteCompletion: (
      ...args: Parameters<typeof actual.setCandidateNoteCompletion>
    ) => setCandidateNoteCompletionMock(...args),
    deleteCandidateNote: (...args: Parameters<typeof actual.deleteCandidateNote>) =>
      deleteCandidateNoteMock(...args),
  };
});

describe("CandidateNotesPanel", () => {
  beforeEach(() => {
    getCandidateNotesMock.mockReset();
    createCandidateNoteMock.mockReset();
    setCandidateNoteCompletionMock.mockReset();
    deleteCandidateNoteMock.mockReset();

    getCandidateNotesMock.mockResolvedValue({
      items: [
        {
          id: "note-1",
          candidateId: "cand-1",
          body: "Kontrol notu",
          reminderAtUtc: null,
          completedAtUtc: null,
          createdByUserId: "user-1",
          createdByName: "Test User",
          createdAtUtc: "2026-01-01T09:00:00Z",
          updatedAtUtc: "2026-01-01T09:00:00Z",
          rowVersion: 1,
        },
      ],
    });
  });

  it("keeps note actions visible but disabled for candidate view-only users", async () => {
    renderWithProviders(<CandidateNotesPanel candidateId="cand-1" />, {
      auth: {
        user: {
          id: "viewer",
          phone: "5073737262",
          name: "Finans",
          roleName: "finans",
          isSuperAdmin: false,
        },
        permissions: { candidates: "view" },
      },
    });

    await screen.findByText("Kontrol notu");

    const addButton = screen.getByRole("button", { name: /Yeni Not/i });
    const toggleButton = screen.getByRole("button", { name: "Tamamlandı olarak işaretle" });
    const deleteButton = screen.getByRole("button", { name: "Sil" });

    expect(addButton).toBeDisabled();
    expect(addButton).toHaveAttribute("title", "Yetkiniz yok.");
    expect(toggleButton).toBeDisabled();
    expect(toggleButton).toHaveAttribute("title", "Yetkiniz yok.");
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("title", "Yetkiniz yok.");

    fireEvent.click(addButton);
    fireEvent.click(toggleButton);
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(createCandidateNoteMock).not.toHaveBeenCalled();
      expect(setCandidateNoteCompletionMock).not.toHaveBeenCalled();
      expect(deleteCandidateNoteMock).not.toHaveBeenCalled();
    });
  });
});
