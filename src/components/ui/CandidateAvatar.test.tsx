import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("opens candidate photo preview and closes it on outside click", async () => {
    render(
      <div>
        <CandidateAvatar
          candidate={{
            id: "candidate-1",
            firstName: "Ayse",
            lastName: "Demir",
            photo: {
              documentId: "document-1",
              kind: "biometric_photo",
            },
          }}
          previewOnClick
        />
        <button type="button">Dış alan</button>
      </div>
    );

    const trigger = await screen.findByRole("button", { name: "Ayse Demir resmini aç" });

    fireEvent.click(trigger);

    expect(screen.getByRole("img", { name: "Ayse Demir aday resmi" })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Dış alan" }));

    await waitFor(() => {
      expect(screen.queryByRole("img", { name: "Ayse Demir aday resmi" })).not.toBeInTheDocument();
    });
  });
});
