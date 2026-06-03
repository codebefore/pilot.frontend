import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";

import { tr } from "./i18n/tr";
import { en } from "./i18n/en";
import { LanguageProvider, useLanguage, useT, currentLocale } from "./i18n";

function LangProbe() {
  const t = useT();
  const { lang, setLang } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="save">{t("common.save")}</span>
      <span data-testid="cancel">{t("common.cancel")}</span>
      <span data-testid="interp">{t("candidatesPage.examTitle.scheduled", { stage: "X" })}</span>
      <button type="button" onClick={() => setLang(lang === "tr" ? "en" : "tr")}>
        toggle
      </button>
    </div>
  );
}

describe("i18n dictionaries", () => {
  it("tr and en share the same key set", () => {
    const trKeys = Object.keys(tr).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(trKeys);
  });

  it("every entry resolves to a non-empty string", () => {
    for (const [key, value] of Object.entries(tr)) {
      expect(typeof value).toBe("string");
      expect(value.length, `tr ${key}`).toBeGreaterThan(0);
    }
    for (const [key, value] of Object.entries(en)) {
      expect(typeof value).toBe("string");
      expect(value.length, `en ${key}`).toBeGreaterThan(0);
    }
  });

  it("interpolation placeholders match across locales", () => {
    const placeholderRe = /\{(\w+)\}/g;
    for (const [key, trValue] of Object.entries(tr)) {
      const enValue = (en as Record<string, string>)[key];
      const trPlaceholders = (trValue.match(placeholderRe) ?? []).sort();
      const enPlaceholders = (enValue.match(placeholderRe) ?? []).sort();
      expect(enPlaceholders, `placeholder parity for ${key}`).toEqual(trPlaceholders);
    }
  });
});

describe("LanguageProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "tr";
  });

  it("defaults to Turkish and renders TR copy", () => {
    render(
      <LanguageProvider>
        <LangProbe />
      </LanguageProvider>
    );

    expect(screen.getByTestId("lang").textContent).toBe("tr");
    expect(screen.getByTestId("save").textContent).toBe(tr["common.save"]);
    expect(screen.getByTestId("cancel").textContent).toBe(tr["common.cancel"]);
  });

  it("switches to English and renders EN copy once the bundle resolves", async () => {
    render(
      <LanguageProvider>
        <LangProbe />
      </LanguageProvider>
    );

    act(() => {
      screen.getByText("toggle").click();
    });

    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(document.documentElement.lang).toBe("en");

    await waitFor(() => {
      expect(screen.getByTestId("save").textContent).toBe(en["common.save"]);
    });
    expect(screen.getByTestId("cancel").textContent).toBe(en["common.cancel"]);
  });

  it("interpolates {placeholder} values", () => {
    render(
      <LanguageProvider>
        <LangProbe />
      </LanguageProvider>
    );

    expect(screen.getByTestId("interp").textContent).toContain("X");
    expect(screen.getByTestId("interp").textContent).not.toContain("{stage}");
  });

  it("persists the chosen language to localStorage", () => {
    render(
      <LanguageProvider>
        <LangProbe />
      </LanguageProvider>
    );

    act(() => {
      screen.getByText("toggle").click();
    });

    expect(localStorage.getItem("pilot.lang")).toBe("en");
  });

  it("currentLocale tracks <html lang>", () => {
    document.documentElement.lang = "tr";
    expect(currentLocale()).toBe("tr-TR");

    document.documentElement.lang = "en";
    expect(currentLocale()).toBe("en-US");
  });
});
