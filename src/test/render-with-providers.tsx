import type { ReactElement } from "react";
import { render } from "@testing-library/react";

import { ToastProvider } from "../components/ui/Toast";
import { LanguageProvider } from "../lib/i18n";

export function renderWithProviders(ui: ReactElement) {
  return render(
    <LanguageProvider>
      <ToastProvider>{ui}</ToastProvider>
    </LanguageProvider>
  );
}
