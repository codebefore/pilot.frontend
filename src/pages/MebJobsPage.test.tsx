import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { MebJobsPage } from "./MebJobsPage";

const getCandidatesMock = vi.fn();
const listMebbisJobsMock = vi.fn();
const listMebbisJobStepsMock = vi.fn();
const cancelMebbisJobMock = vi.fn();
const createCandidateLookupJobMock = vi.fn();

vi.mock("../lib/candidates-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/candidates-api")>(
    "../lib/candidates-api"
  );

  return {
    ...actual,
    getCandidates: (...args: Parameters<typeof actual.getCandidates>) => getCandidatesMock(...args),
  };
});

vi.mock("../lib/mebbis-jobs-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/mebbis-jobs-api")>(
    "../lib/mebbis-jobs-api"
  );

  return {
    ...actual,
    listMebbisJobs: (...args: Parameters<typeof actual.listMebbisJobs>) =>
      listMebbisJobsMock(...args),
    listMebbisJobSteps: (...args: Parameters<typeof actual.listMebbisJobSteps>) =>
      listMebbisJobStepsMock(...args),
    cancelMebbisJob: (...args: Parameters<typeof actual.cancelMebbisJob>) =>
      cancelMebbisJobMock(...args),
    createCandidateLookupJob: (...args: Parameters<typeof actual.createCandidateLookupJob>) =>
      createCandidateLookupJobMock(...args),
  };
});

const runningJob = {
  id: "11111111-1111-1111-1111-111111111111",
  jobType: "candidate_lookup",
  entityType: "candidate",
  entityId: "candidate-1",
  status: "running",
  priority: 0,
  payloadJson: JSON.stringify({ nationalId: "12345678901" }),
  resultJson: null,
  errorMessage: null,
  attemptCount: 1,
  maxAttemptCount: 3,
  nextAttemptAtUtc: null,
  leaseOwnerClientId: null,
  leaseExpiresAtUtc: null,
  queuePublishedAtUtc: "2026-05-30T09:59:05Z",
  queuePublishLastAttemptAtUtc: "2026-05-30T09:59:05Z",
  queuePublishAttemptCount: 1,
  queuePublishError: null,
  startedAtUtc: "2026-05-30T10:00:00Z",
  completedAtUtc: null,
  createdAtUtc: "2026-05-30T09:59:00Z",
  updatedAtUtc: "2026-05-30T10:00:00Z",
  rowVersion: 1,
};

function renderPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/meb-jobs"]}>
      <MebJobsPage />
    </MemoryRouter>,
    {
      auth: {
        user: {
          id: "meb-viewer",
          phone: "5073737262",
          name: "MEB Viewer",
          roleName: "MEB İzleme",
          isSuperAdmin: false,
        },
        permissions: { mebjobs: "view" },
      },
    }
  );
}

describe("MebJobsPage", () => {
  beforeEach(() => {
    getCandidatesMock.mockReset();
    listMebbisJobsMock.mockReset();
    listMebbisJobStepsMock.mockReset();
    cancelMebbisJobMock.mockReset();
    createCandidateLookupJobMock.mockReset();

    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "candidate-1",
          firstName: "Ali",
          lastName: "Veli",
          nationalId: "12345678901",
        },
      ],
    });
    listMebbisJobsMock.mockResolvedValue([runningJob]);
    listMebbisJobStepsMock.mockResolvedValue([]);
  });

  it("shows MEB jobs to view-only users but disables mutating actions", async () => {
    renderPage();

    expect(await screen.findByText("Aday Durum Görüntüleme")).toBeInTheDocument();
    expect(screen.getByText("Stream")).toBeInTheDocument();

    const newJobButton = screen.getByRole("button", { name: /Yeni MEB İşi/ });
    expect(newJobButton).toBeDisabled();
    expect(newJobButton).toHaveAttribute("title", "Yetkiniz yok.");

    const rowCancelButton = screen.getByRole("button", { name: "İptal" });
    expect(rowCancelButton).toBeDisabled();
    expect(rowCancelButton).toHaveAttribute("title", "Yetkiniz yok.");

    fireEvent.click(rowCancelButton);
    fireEvent.click(newJobButton);

    expect(cancelMebbisJobMock).not.toHaveBeenCalled();
    expect(createCandidateLookupJobMock).not.toHaveBeenCalled();
  });
});
