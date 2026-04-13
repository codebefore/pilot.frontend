import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CandidateDocumentBadge } from "./CandidateDocumentBadge";
import { renderWithProviders } from "../../test/render-with-providers";

describe("CandidateDocumentBadge", () => {
  it("renders the completed/total fraction when complete", () => {
    renderWithProviders(
      <CandidateDocumentBadge
        summary={{ completedCount: 5, missingCount: 0, totalRequiredCount: 5 }}
      />
    );

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("5/5");
    expect(button).toHaveClass("complete");
  });

  it("renders the completed/total fraction when documents are missing", () => {
    renderWithProviders(
      <CandidateDocumentBadge
        summary={{ completedCount: 1, missingCount: 8, totalRequiredCount: 9 }}
      />
    );

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("1/9");
    expect(button).toHaveClass("missing");
  });

  it("renders an em-dash placeholder when summary is null", () => {
    renderWithProviders(<CandidateDocumentBadge summary={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("opens a popover with the placeholder hint when missing list is unknown", () => {
    renderWithProviders(
      <CandidateDocumentBadge
        summary={{ completedCount: 0, missingCount: 2, totalRequiredCount: 2 }}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(
      screen.getByText("Eksik evrak detayları yakında")
    ).toBeInTheDocument();
  });

  it("uses the supplied missingDocumentNames in the popover when available", () => {
    renderWithProviders(
      <CandidateDocumentBadge
        missingDocumentNames={["Sağlık Raporu", "Fotoğraf"]}
        summary={{ completedCount: 1, missingCount: 2, totalRequiredCount: 3 }}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Sağlık Raporu")).toBeInTheDocument();
    expect(screen.getByText("Fotoğraf")).toBeInTheDocument();
  });

  it("lazy-loads missing names when the popover opens and caches them", async () => {
    const loader = vi.fn().mockResolvedValue(["İkametgah", "Ehliyet"]);
    renderWithProviders(
      <CandidateDocumentBadge
        loadMissingDocumentNames={loader}
        summary={{ completedCount: 0, missingCount: 2, totalRequiredCount: 2 }}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("İkametgah")).toBeInTheDocument();
    });
    expect(screen.getByText("Ehliyet")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(1);

    // Close + reopen → still no second fetch.
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("shows a load error message when the lazy loader rejects", async () => {
    const loader = vi.fn().mockRejectedValue(new Error("boom"));
    renderWithProviders(
      <CandidateDocumentBadge
        loadMissingDocumentNames={loader}
        summary={{ completedCount: 0, missingCount: 1, totalRequiredCount: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("Eksik evraklar getirilemedi")).toBeInTheDocument();
    });
  });

  it("calls onClick instead of toggling the popover when handler is provided", () => {
    const handler = vi.fn();
    renderWithProviders(
      <CandidateDocumentBadge
        onClick={handler}
        summary={{ completedCount: 0, missingCount: 1, totalRequiredCount: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stops click events from bubbling so parent rows are not triggered", () => {
    const rowClick = vi.fn();
    renderWithProviders(
      <div onClick={rowClick}>
        <CandidateDocumentBadge
          summary={{ completedCount: 5, missingCount: 0, totalRequiredCount: 5 }}
        />
      </div>
    );

    fireEvent.click(screen.getByRole("button"));

    expect(rowClick).not.toHaveBeenCalled();
  });
});
