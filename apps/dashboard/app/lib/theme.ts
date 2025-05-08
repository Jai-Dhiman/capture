import { atom } from "jotai";

// Theme types
export type Theme = "light" | "dark" | "system";

// Create atom for theme state
export const themeAtom = atom<Theme>(
  typeof document !== "undefined" ? (localStorage.getItem("theme") as Theme) || "system" : "system"
);

// Helper to set theme in DOM and localStorage
export function setTheme(theme: Theme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  localStorage.setItem("theme", theme);
}
