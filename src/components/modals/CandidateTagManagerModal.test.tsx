import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { CandidateTagManagerModal } from "./CandidateTagManagerModal";

describe("CandidateTagManagerModal", () => {
  it("keeps tag mutation actions disabled when management is not allowed", () => {
    renderWithProviders(
      <CandidateTagManagerModal
        canManage={false}
        onClose={() => {}}
        onDeleted={vi.fn()}
        onRenamed={vi.fn()}
        open
        tags={[{ id: "tag-1", name: "VIP", usageCount: 2 }]}
      />
    );

    const editButton = screen.getByRole("button", { name: "Düzenle" });
    const deleteButton = screen.getByRole("button", { name: "Sil" });

    expect(editButton).toBeDisabled();
    expect(editButton).toHaveAttribute("title", "Yetkiniz yok.");
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("title", "Yetkiniz yok.");

    fireEvent.click(editButton);
    fireEvent.click(deleteButton);

    expect(screen.queryByRole("button", { name: "Kaydet" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Evet, Sil" })).not.toBeInTheDocument();
  });
});
