import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AuthInstitution } from "../../lib/auth-storage";
import { LanguageProvider } from "../../lib/i18n";
import { ToastProvider } from "../ui/Toast";
import { InstitutionSelector } from "./InstitutionSelector";

const institutions: AuthInstitution[] = [
  {
    id: "kurum-a",
    name: "Kurum A",
    roleName: "Yönetici",
    isDefault: true,
    permissions: { dashboard: "view" },
  },
  {
    id: "kurum-b",
    name: "Kurum B",
    roleName: "Personel",
    isDefault: false,
    permissions: { candidates: "view" },
  },
];

function renderSelector(activeId = "") {
  const onSelect = vi.fn().mockResolvedValue(undefined);
  render(
    <LanguageProvider>
      <ToastProvider>
        <InstitutionSelector activeId={activeId} institutions={institutions} onSelect={onSelect} />
      </ToastProvider>
    </LanguageProvider>
  );
  return { onSelect };
}

describe("InstitutionSelector", () => {
  it("does not show the first institution as active when activeId is empty", () => {
    renderSelector();

    expect(screen.getByRole("button", { name: /Kurum seç/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Kurum A/i })).not.toBeInTheDocument();
  });

  it("selects an institution from the menu", async () => {
    const { onSelect } = renderSelector("kurum-a");

    fireEvent.click(screen.getByRole("button", { name: /Kurum A/i }));
    fireEvent.click(screen.getByRole("button", { name: /Kurum B.*Personel/i }));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("kurum-b"));
  });
});
