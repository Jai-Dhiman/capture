"use client"

import { useEffect } from "react";
import { useAtom } from "jotai";
import { Moon, Sun } from "lucide-react";
import { themeAtom, setTheme, type Theme } from "../lib/theme";
import { Button } from "./ui/button";

export function ThemeToggle() {
  const [theme, setThemeAtom] = useAtom(themeAtom);

  // Apply theme on mount and when theme changes
  useEffect(() => {
    setTheme(theme);

    // Listen for system color scheme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        setTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Toggle between light and dark mode
  const toggleTheme = () => {
    // Check current effective theme (what's actually showing)
    const isDarkMode = document.documentElement.classList.contains("dark");

    // Toggle to opposite mode
    setThemeAtom(isDarkMode ? "light" : "dark");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-10 w-10"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
} 