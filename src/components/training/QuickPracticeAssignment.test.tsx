import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import type { CandidateResponse } from "../../lib/types";
import { QuickPracticeAssignment } from "./QuickPracticeAssignment";

describe("QuickPracticeAssignment", () => {
  it("opens candidate detail without changing the selected candidate", () => {
    const onSettingsChange = vi.fn();
    const candidate = {
      id: "candidate-1",
      firstName: "Muhsin",
      lastName: "Temelli",
      licenseClass: "B",
      status: "active",
    } as CandidateResponse;

    renderWithProviders(
      <MemoryRouter>
        <QuickPracticeAssignment
          candidateId={candidate.id}
          candidates={[candidate]}
          onSettingsChange={onSettingsChange}
        />
      </MemoryRouter>
    );

    const detailLink = screen.getByRole("link", { name: /Muhsin Temelli/i });
    expect(detailLink).toHaveAttribute("href", "/candidates/candidate-1");
    expect(detailLink).toHaveAttribute("target", "_blank");
    expect(detailLink).toHaveAttribute("rel", "noopener noreferrer");

    fireEvent.click(detailLink);

    expect(onSettingsChange).not.toHaveBeenCalled();
  });
});
