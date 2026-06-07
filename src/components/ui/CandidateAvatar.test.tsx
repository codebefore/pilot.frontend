import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CandidateAvatar } from "./CandidateAvatar";

vi.mock("../../lib/authorized-files", () => ({
  createAuthorizedObjectUrl: (url: string) => Promise.resolve(url),
}));

describe("CandidateAvatar", () => {
  it("falls back when candidate name parts are missing", () => {
    render(<CandidateAvatar candidate={{ id: "candidate-1", photo: null }} />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("does not use webcam photos as profile images", () => {
    render(
      <CandidateAvatar
        candidate={{
          id: "candidate-1",
          firstName: "Ali",
          lastName: "Veli",
          photo: {
            documentId: "document-1",
            kind: "webcam_photo",
          },
        }}
      />
    );

    expect(screen.getByText("AV")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
