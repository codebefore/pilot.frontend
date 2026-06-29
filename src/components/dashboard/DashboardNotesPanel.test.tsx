import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardNotesPanel } from "./DashboardNotesPanel";
import { renderWithProviders } from "../../test/render-with-providers";

const getUserNotesMock = vi.fn();
const createUserNoteMock = vi.fn();
const updateUserNoteMock = vi.fn();
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
    updateUserNote: (...args: Parameters<typeof actual.updateUserNote>) =>
      updateUserNoteMock(...args),
    setUserNoteCompletion: (...args: Parameters<typeof actual.setUserNoteCompletion>) =>
      setUserNoteCompletionMock(...args),
    deleteUserNote: (...args: Parameters<typeof actual.deleteUserNote>) =>
      deleteUserNoteMock(...args),
  };
});

describe("DashboardNotesPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T09:00:00Z"));
    getUserNotesMock.mockReset();
    createUserNoteMock.mockReset();
    updateUserNoteMock.mockReset();
    setUserNoteCompletionMock.mockReset();
    deleteUserNoteMock.mockReset();

    getUserNotesMock.mockResolvedValue({
      items: [
        {
          id: "note-1",
          createdByUserId: "viewer",
          body: "Dashboard notu",
          isVisibleToInstitution: false,
          reminderAtUtc: null,
          completedAtUtc: null,
          createdAtUtc: "2026-01-01T09:00:00Z",
          updatedAtUtc: "2026-01-01T09:00:00Z",
          rowVersion: 1,
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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

    const addButton = screen.getByRole("button", { name: /Yeni Görev/i });
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

  it("shows the calendar even when there are no notes", async () => {
    getUserNotesMock.mockResolvedValue({ items: [] });

    renderWithProviders(<DashboardNotesPanel />);

    expect(await screen.findByLabelText("Not takvimi")).toBeInTheDocument();
    expect(screen.getByText("Bu güne ait görev yok.")).toBeInTheDocument();
    expect(screen.queryByText("Henüz not yok. Yeni not ekleyebilirsin.")).not.toBeInTheDocument();
  });

  it("filters reminder notes by the selected calendar date", async () => {
    getUserNotesMock.mockResolvedValue({
      items: [
        buildNote({ id: "note-10", body: "10 Ocak notu", reminderAtUtc: "2026-01-10T09:00:00Z" }),
        buildNote({ id: "note-11", body: "11 Ocak notu", reminderAtUtc: "2026-01-11T09:00:00Z" }),
        buildNote({ id: "note-undated", body: "Tarihsiz kokpit notu", reminderAtUtc: null }),
      ],
    });

    renderWithProviders(<DashboardNotesPanel />);

    await screen.findByText("Tarihsiz kokpit notu");
    expect(screen.queryByText("10 Ocak notu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /10 Ocak/i }));

    expect(await screen.findByText("10 Ocak notu")).toBeInTheDocument();
    expect(screen.queryByText("11 Ocak notu")).not.toBeInTheDocument();
    expect(screen.getByText("Tarihsiz kokpit notu")).toBeInTheDocument();
  });

  it("keeps undated notes in a separate section", async () => {
    getUserNotesMock.mockResolvedValue({
      items: [
        buildNote({ id: "dated", body: "Bugünün hatırlatması", reminderAtUtc: "2026-01-01T09:00:00Z" }),
        buildNote({ id: "undated", body: "Takvimsiz not", reminderAtUtc: null }),
      ],
    });

    renderWithProviders(<DashboardNotesPanel />);

    await screen.findByText("Bugünün hatırlatması");
    expect(screen.getByText("Tarihsiz görevler")).toBeInTheDocument();
    expect(screen.getByText("Takvimsiz not")).toBeInTheDocument();
  });

  it("changes month and shows notes for a day in the new month", async () => {
    getUserNotesMock.mockResolvedValue({
      items: [
        buildNote({ id: "feb-note", body: "Şubat notu", reminderAtUtc: "2026-02-05T09:00:00Z" }),
      ],
    });

    renderWithProviders(<DashboardNotesPanel />);

    await screen.findByText("Bu güne ait görev yok.");
    fireEvent.click(screen.getByRole("button", { name: "Sonraki ay" }));
    fireEvent.click(screen.getByRole("button", { name: /^5 Şubat/i }));

    expect(await screen.findByText("Şubat notu")).toBeInTheDocument();
  });
});

function buildNote(overrides: {
  id: string;
  body: string;
  reminderAtUtc: string | null;
}) {
  return {
    createdByUserId: "test-user",
    completedAtUtc: null,
    createdAtUtc: "2026-01-01T09:00:00Z",
    isVisibleToInstitution: false,
    updatedAtUtc: "2026-01-01T09:00:00Z",
    rowVersion: 1,
    ...overrides,
  };
}
