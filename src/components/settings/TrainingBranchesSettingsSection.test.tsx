import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { TrainingBranchesSettingsSection } from "./TrainingBranchesSettingsSection";

const getTrainingBranchDefinitionsMock = vi.fn();

vi.mock("../../lib/training-branch-definitions-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/training-branch-definitions-api")>(
    "../../lib/training-branch-definitions-api"
  );

  return {
    ...actual,
    getTrainingBranchDefinitions: (
      ...args: Parameters<typeof actual.getTrainingBranchDefinitions>
    ) => getTrainingBranchDefinitionsMock(...args),
  };
});

const branch = {
  id: "branch-practice",
  code: "practice",
  name: "Direksiyon",
  totalLessonHourLimit: null,
  colorHex: "#3e5660",
  displayOrder: 10,
  isActive: true,
  notes: null,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
  rowVersion: 1,
};

describe("TrainingBranchesSettingsSection", () => {
  beforeEach(() => {
    getTrainingBranchDefinitionsMock.mockReset();
    getTrainingBranchDefinitionsMock.mockResolvedValue({
      items: [branch],
      page: 1,
      pageSize: 100,
      totalCount: 1,
      totalPages: 1,
      summary: {
        activeCount: 1,
        limitedCount: 0,
      },
    });
  });

  it("disables global catalog mutations for non-super-admin users", async () => {
    renderWithProviders(<TrainingBranchesSettingsSection />, {
      auth: {
        user: {
          id: "training-manager",
          phone: "5000000001",
          name: "Training Manager",
          roleName: "Eğitim",
          isSuperAdmin: false,
        },
        permissions: { training: "full" },
      },
    });

    await waitFor(() => {
      expect(getTrainingBranchDefinitionsMock).toHaveBeenCalledWith(
        { activity: "all", page: 1, pageSize: 100 }
      );
    });
    expect(await screen.findByText("Direksiyon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Düzenle" })).toBeDisabled();
  });
});
