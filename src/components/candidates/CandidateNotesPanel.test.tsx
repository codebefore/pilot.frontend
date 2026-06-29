import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CandidateNotesPanel } from "./CandidateNotesPanel";
import { renderWithProviders } from "../../test/render-with-providers";

const getCandidateNotesMock = vi.fn();
const createCandidateNoteMock = vi.fn();
const setCandidateNoteCompletionMock = vi.fn();
const deleteCandidateNoteMock = vi.fn();
const createUserNoteMock = vi.fn();

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

vi.mock("../../lib/user-notes-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/user-notes-api")>(
    "../../lib/user-notes-api"
  );
  return {
    ...actual,
    createUserNote: (...args: Parameters<typeof actual.createUserNote>) =>
      createUserNoteMock(...args),
  };
});

describe("CandidateNotesPanel", () => {
  beforeEach(() => {
    getCandidateNotesMock.mockReset();
    createCandidateNoteMock.mockReset();
    setCandidateNoteCompletionMock.mockReset();
    deleteCandidateNoteMock.mockReset();
    createUserNoteMock.mockReset();

    getCandidateNotesMock.mockResolvedValue({
      items: [
        {
          id: "note-1",
          candidateId: "cand-1",
          body: "Kontrol notu",
          reminderAtUtc: "2026-06-19T00:10:00Z",
          completedAtUtc: null,
          createdByUserId: "user-1",
          createdByName: "Test User",
          createdAtUtc: "2026-06-07T15:34:00Z",
          updatedAtUtc: "2026-06-07T15:34:00Z",
          rowVersion: 1,
        },
      ],
    });
    createCandidateNoteMock.mockResolvedValue({
      id: "note-created",
      candidateId: "cand-1",
      body: "Yeni aday notu",
      reminderAtUtc: null,
      completedAtUtc: null,
      createdByUserId: "test-user",
      createdByName: "Test User",
      createdAtUtc: "2026-06-29T10:15:00Z",
      updatedAtUtc: "2026-06-29T10:15:00Z",
      rowVersion: 1,
    });
    createUserNoteMock.mockResolvedValue({
      id: "task-created",
      createdByUserId: "test-user",
      body: "Yeni aday notu",
      isVisibleToInstitution: false,
      candidateId: "cand-1",
      candidateName: "Ayşe Demir",
      reminderAtUtc: "2026-06-29T10:15:00Z",
      completedAtUtc: null,
      createdAtUtc: "2026-06-29T10:15:00Z",
      updatedAtUtc: "2026-06-29T10:15:00Z",
      rowVersion: 1,
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
    expect(screen.getByText(/19\.06\.2026/)).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.queryByText(/07\.06\.2026/)).not.toBeInTheDocument();

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
      expect(createUserNoteMock).not.toHaveBeenCalled();
      expect(setCandidateNoteCompletionMock).not.toHaveBeenCalled();
      expect(deleteCandidateNoteMock).not.toHaveBeenCalled();
    });
  });

  it("can create a candidate note and mirror it to dashboard tasks using created date when no reminder is selected", async () => {
    renderWithProviders(<CandidateNotesPanel candidateId="cand-1" candidateName="Ayşe Demir" />);

    await screen.findByText("Kontrol notu");

    fireEvent.click(screen.getByRole("button", { name: /Yeni Not/i }));
    fireEvent.change(screen.getByLabelText("Not"), { target: { value: "Yeni aday notu" } });
    fireEvent.click(screen.getByLabelText("Görevlere ekle"));
    fireEvent.click(screen.getByRole("button", { name: "Ekle" }));

    await waitFor(() => {
      expect(createCandidateNoteMock).toHaveBeenCalledWith(
        "cand-1",
        { body: "Yeni aday notu", reminderAtUtc: null }
      );
      expect(createUserNoteMock).toHaveBeenCalledWith({
        body: "Yeni aday notu",
        reminderAtUtc: "2026-06-29T10:15:00Z",
        isVisibleToInstitution: false,
        candidateId: "cand-1",
        candidateName: "Ayşe Demir",
      });
    });
  });

  it("asks for confirmation before deleting a candidate note", async () => {
    deleteCandidateNoteMock.mockResolvedValue(undefined);
    renderWithProviders(<CandidateNotesPanel candidateId="cand-1" />);

    await screen.findByText("Kontrol notu");

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));

    expect(deleteCandidateNoteMock).not.toHaveBeenCalled();
    const firstPopover = screen.getByRole("alertdialog", { name: "Not silme onayı" });
    expect(within(firstPopover).getByText("Not silinsin mi?")).toBeInTheDocument();

    fireEvent.click(within(firstPopover).getByRole("button", { name: "Vazgeç" }));

    expect(screen.queryByRole("alertdialog", { name: "Not silme onayı" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    const secondPopover = screen.getByRole("alertdialog", { name: "Not silme onayı" });
    fireEvent.click(within(secondPopover).getByRole("button", { name: "Sil" }));

    await waitFor(() => {
      expect(deleteCandidateNoteMock).toHaveBeenCalledWith("cand-1", "note-1");
    });
  });
});
