import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { TasksPage } from "./TasksPage";

const getUserNotesMock = vi.fn();

vi.mock("../lib/user-notes-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/user-notes-api")>(
    "../lib/user-notes-api"
  );
  return {
    ...actual,
    getUserNotes: (...args: Parameters<typeof actual.getUserNotes>) =>
      getUserNotesMock(...args),
  };
});

describe("TasksPage", () => {
  beforeEach(() => {
    getUserNotesMock.mockReset();
  });

  it("shows the creator only for institution-visible tasks", async () => {
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
    expect(screen.getByText("Yalnızca oluşturan kişi güncelleyebilir veya silebilir.")).toBeInTheDocument();
    expect(screen.getByText("Paylaşılan görev").closest("li")?.querySelector('button[aria-label="Sil"]')).toHaveAttribute(
      "title",
      "Görevi Ayşe Demir oluşturdu. Yalnızca oluşturan kişi güncelleyebilir veya silebilir."
    );
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
