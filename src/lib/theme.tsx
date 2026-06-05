import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { TranslationKey } from "./i18n";

export type AppTheme = "pilot" | "emerald" | "blueDark" | "midnight";

export type ThemeOption = {
  key: AppTheme;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  swatches: string[];
};

export const THEME_OPTIONS: ThemeOption[] = [
  {
    key: "pilot",
    labelKey: "theme.pilot.label",
    descriptionKey: "theme.pilot.description",
    swatches: ["#ED2AA3", "#4694F6", "#ffffff", "#1a1a2e"],
  },
  {
    key: "emerald",
    labelKey: "theme.emerald.label",
    descriptionKey: "theme.emerald.description",
    swatches: ["#4694F6", "#ED2AA3", "#ffffff", "#0f172a"],
  },
  {
    key: "blueDark",
    labelKey: "theme.blueDark.label",
    descriptionKey: "theme.blueDark.description",
    swatches: ["#F354B9", "#62A5F9", "#0b1220", "#f8fafc"],
  },
  {
    key: "midnight",
    labelKey: "theme.midnight.label",
    descriptionKey: "theme.midnight.description",
    swatches: ["#ED2AA3", "#4694F6", "#111827", "#f9fafb"],
  },
];

const STORAGE_KEY = "pilot.theme";
const DEFAULT_THEME: AppTheme = "pilot";

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  options: ThemeOption[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isAppTheme(value: string | null): value is AppTheme {
  return value === "pilot" || value === "emerald" || value === "blueDark" || value === "midnight";
}

function getInitialTheme(): AppTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isAppTheme(stored) ? stored : DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      options: THEME_OPTIONS,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
