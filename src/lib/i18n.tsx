import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { tr } from "./i18n/tr";
import type { TranslationKey } from "./i18n/tr";

export type { TranslationKey };

type Language = "tr" | "en";

const STORAGE_KEY = "pilot.lang";
const DEFAULT_LANG: Language = "tr";

/* ── Dictionary loading ───────────────────────────────────────── */

type Dictionary = Record<TranslationKey, string>;

let enDictPromise: Promise<Dictionary> | null = null;
function loadEn(): Promise<Dictionary> {
  if (!enDictPromise) {
    enDictPromise = import("./i18n/en")
      .then((m) => m.en)
      .catch((err) => {
        // Reset the cached promise on failure so the next language switch
        // retries the dynamic import (e.g. user comes back online after a
        // chunk fetch failure). Without this reset a single failed load
        // would lock the EN locale broken for the tab lifetime.
        enDictPromise = null;
        throw err;
      });
  }
  return enDictPromise;
}

/* ── Context ──────────────────────────────────────────────────── */

type LanguageContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const fallbackLanguageContext: LanguageContextValue = {
  lang: DEFAULT_LANG,
  setLang: () => undefined,
  t: (key, params) => interpolate(tr[key] ?? key, params),
};

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

function readStoredLang(): Language {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "tr" || raw === "en") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => readStoredLang());
  const [enDict, setEnDict] = useState<Dictionary | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;
  }, [lang]);

  // Lazy-load the EN bundle the first time the user switches to English.
  // Until it resolves, t() falls back to TR — no flash of missing strings.
  useEffect(() => {
    if (lang === "en" && !enDict) {
      let cancelled = false;
      void loadEn().then((dict) => {
        if (!cancelled) setEnDict(dict);
      });
      return () => {
        cancelled = true;
      };
    }
  }, [lang, enDict]);

  const setLang = useCallback((next: Language) => setLangState(next), []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const dict = lang === "en" && enDict ? enDict : tr;
      const template = dict[key] ?? tr[key] ?? key;
      return interpolate(template, params);
    },
    [lang, enDict]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  return ctx ?? fallbackLanguageContext;
}

export function useT() {
  return useLanguage().t;
}

/**
 * BCP 47 locale tag for `Intl.*` / `Date#toLocaleString` calls. Reads
 * `document.documentElement.lang` so module-level helpers (outside React
 * components) can call this without a hook. The `<html lang>` attribute is
 * kept in sync by `LanguageProvider`.
 */
export function currentLocale(): string {
  if (typeof document === "undefined") return "tr-TR";
  return document.documentElement.lang === "en" ? "en-US" : "tr-TR";
}
