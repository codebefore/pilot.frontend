import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardNotesPanel } from "./DashboardNotesPanel";
import { renderWithProviders } from "../../test/render-with-providers";

const getUserNotesMock = vi.fn();
const createUserNoteMock = vi.fn();
const setUserNoteCompletionMock = vi.fn();
const deleteUserNoteMock = vi.fn();

vi.mock("../../lib/user-notes-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/user-notes-api")>(
    "../../lib/user-notes-api"
  );
  return {
    ...actual,
    getUserNotes: (...args: Parameters<typeof actual.getUserNotes>) =>
      getUserNotesMock(...args),
    createUserNote: (...args: Parameters<typeof actual.createUserNote>) =>
      createUserNoteMock(...args),
    setUserNoteCompletion: (...args: Parameters<typeof actual.setUserNoteCompletion>) =>
      setUserNoteCompletionMock(...args),
    deleteUserNote: (...args: Parameters<typeof actual.deleteUserNote>) =>
      deleteUserNoteMock(...args),
  };
});

describe("DashboardNotesPanel", () => {
  beforeEach(() => {
    getUserNotesMock.mockReset();
    createUserNoteMock.mockReset();
    setUserNoteCompletionMock.mockReset();
    deleteUserNoteMock.mockReset();

    getUserNotesMock.mockResolvedValue({
      items: [
        {
          id: "note-1",
          body: "Dashboard notu",
          reminderAtUtc: null,
          completedAtUtc: null,
          createdAtUtc: "2026-01-01T09:00:00Z",
          updatedAtUtc: "2026-01-01T09:00:00Z",
          rowVersion: 1,
        },
      ],
    });
  });

  it("keeps note actions visible but disabled for dashboard view-only users", async () => {
    renderWithProviders(<DashboardNotesPanel />, {
      auth: {
        user: {
          id: "viewer",
          phone: "5073737262",
          name: "Finans",
          roleName: "finans",
          isSuperAdmin: false,
        },
        permissions: { dashboard: "view" },
      },
    });

    await screen.findByText("Dashboard notu");

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
      expect(createUserNoteMock).not.toHaveBeenCalled();
      expect(setUserNoteCompletionMock).not.toHaveBeenCalled();
      expect(deleteUserNoteMock).not.toHaveBeenCalled();
    });
  });
});
