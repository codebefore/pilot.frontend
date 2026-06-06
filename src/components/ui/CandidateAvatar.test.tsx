import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CandidateAvatar } from "./CandidateAvatar";

describe("CandidateAvatar", () => {
  it("falls back when candidate name parts are missing", () => {
    render(<CandidateAvatar candidate={{ id: "candidate-1", photo: null }} />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
