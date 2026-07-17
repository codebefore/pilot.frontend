import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { TasksPage } from "./TasksPage";

const getUserNotesMock = vi.fn();
const setUserNoteCompletionMock = vi.fn();

vi.mock("../lib/user-notes-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/user-notes-api")>(
    "../lib/user-notes-api"
  );
  return {
    ...actual,
    getUserNotes: (...args: Parameters<typeof actual.getUserNotes>) =>
      getUserNotesMock(...args),
    setUserNoteCompletion: (...args: Parameters<typeof actual.setUserNoteCompletion>) =>
      setUserNoteCompletionMock(...args),
  };
});

describe("TasksPage", () => {
  beforeEach(() => {
    getUserNotesMock.mockReset();
    setUserNoteCompletionMock.mockReset();
  });

  it("lets managers complete institution-visible tasks created by another user", async () => {
    getUserNotesMock.mockResolvedValue({
      items: [
        buildNote({
          id: "shared-note",
          createdByUserId: "other-user",
          body: "Paylaşılan görev",
          isVisibleToInstitution: true,
          createdByUserName: "Ayşe Demir",
        }),
        buildNote({
          id: "private-note",
          body: "Özel görev",
          isVisibleToInstitution: false,
          createdByUserName: "Mehmet Kaya",
        }),
      ],
    });

    renderWithProviders(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Oluşturan: Ayşe Demir")).toBeInTheDocument();
    const sharedNote = screen.getByText("Paylaşılan görev").closest("li");
    expect(screen.queryByText("Yalnızca oluşturan kişi düzenleyebilir veya silebilir.")).not.toBeInTheDocument();
    expect(sharedNote?.querySelector('button[aria-label="Düzenle"]')).not.toBeInTheDocument();
    expect(sharedNote?.querySelector('button[aria-label="Sil"]')).not.toBeInTheDocument();
    const sharedToggle = sharedNote?.querySelector<HTMLButtonElement>(
      'button[aria-label="Tamamlandı olarak işaretle"]'
    );
    expect(sharedToggle).toBeEnabled();
    fireEvent.click(sharedToggle!);
    await waitFor(() => expect(setUserNoteCompletionMock).toHaveBeenCalledWith("shared-note", true));
    expect(screen.queryByText("Oluşturan: Mehmet Kaya")).not.toBeInTheDocument();
  });
});

function buildNote(overrides: {
  id: string;
  createdByUserId?: string;
  body: string;
  isVisibleToInstitution: boolean;
  createdByUserName: string;
}) {
  return {
    createdByUserId: "test-user",
    reminderAtUtc: null,
    completedAtUtc: null,
    createdAtUtc: "2026-07-15T08:00:00Z",
    updatedAtUtc: "2026-07-15T08:00:00Z",
    candidateId: null,
    candidateName: null,
    rowVersion: 1,
    ...overrides,
  };
}
