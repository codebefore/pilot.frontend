import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppTheme = "pilot" | "emerald" | "blueDark" | "midnight";

export type ThemeOption = {
  key: AppTheme;
  label: string;
  description: string;
  swatches: string[];
};

export const THEME_OPTIONS: ThemeOption[] = [
  {
    key: "pilot",
    label: "Pilot",
    description: "Mevcut turkuaz kurumsal tema",
    swatches: ["#22B094", "#f9fafb", "#ffffff", "#1a1a2e"],
  },
  {
    key: "emerald",
    label: "Mavi",
    description: "Canlı mavi vurgu ve ferah açık yüzeyler",
    swatches: ["#38b6ff", "#f6fbff", "#ffffff", "#0f172a"],
  },
  {
    key: "blueDark",
    label: "Mavi Koyu",
    description: "Mavi vurgu ile koyu çalışma yüzeyi",
    swatches: ["#38b6ff", "#0b1220", "#162033", "#f8fafc"],
  },
  {
    key: "midnight",
    label: "Gece",
    description: "Koyu yüzeyler ve yüksek kontrast",
    swatches: ["#38c7aa", "#111827", "#1f2937", "#f9fafb"],
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
