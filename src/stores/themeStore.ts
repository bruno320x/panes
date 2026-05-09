import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  resolvedTheme: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "panes:themeMode";

function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return getSystemTheme();
  }
  return mode;
}

function loadSavedMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  } catch {
    // Ignore storage failures
  }
  return "system";
}

function applyTheme(theme: "light" | "dark") {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: loadSavedMode(),
  resolvedTheme: resolveTheme(loadSavedMode()),

  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore storage failures
    }
    const resolvedTheme = resolveTheme(mode);
    applyTheme(resolvedTheme);
    set({ mode, resolvedTheme });
  },

  toggleTheme: () => {
    const { mode, resolvedTheme } = get();
    let nextMode: ThemeMode;
    if (mode === "system") {
      // If system, toggle to the opposite of current resolved theme
      nextMode = resolvedTheme === "dark" ? "light" : "dark";
    } else {
      // If explicit mode, switch to the opposite
      nextMode = mode === "dark" ? "light" : "dark";
    }
    get().setMode(nextMode);
  },
}));

// Listen for system theme changes when in system mode
if (typeof window !== "undefined" && window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const { mode, resolvedTheme } = useThemeStore.getState();
    if (mode === "system") {
      const newResolved = getSystemTheme();
      if (newResolved !== resolvedTheme) {
        applyTheme(newResolved);
        useThemeStore.setState({ resolvedTheme: newResolved });
      }
    }
  });
}