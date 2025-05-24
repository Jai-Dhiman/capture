"use client";

import { ClerkProvider } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import { useEffect, useState } from "react";
import { env } from "../../lib/env";

export function ClerkAppProvider({ children }: { children: React.ReactNode }) {
  // To detect dark mode for Clerk UI
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check if dark mode is enabled
    const isDark = document.documentElement.classList.contains("dark");
    setIsDarkMode(isDark);

    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.attributeName === "class" &&
          mutation.target === document.documentElement
        ) {
          const isDarkNow = document.documentElement.classList.contains("dark");
          setIsDarkMode(isDarkNow);
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Skip Clerk Provider in dev if key is missing
  if (!env.CLERK_PUBLISHABLE_KEY) {
    console.error("Missing Clerk publishable key. Authentication will not work.");
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={env.CLERK_PUBLISHABLE_KEY}
      appearance={{
        baseTheme: isDarkMode ? dark : undefined,
        elements: {
          formButtonPrimary:
            "bg-indigo-600 hover:bg-indigo-700 text-sm normal-case",
          card: "bg-white dark:bg-gray-800 shadow-sm",
          headerTitle: "text-gray-900 dark:text-white",
          headerSubtitle: "text-gray-500 dark:text-gray-400",
          socialButtonsBlockButton:
            "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 dark:text-white",
          socialButtonsBlockButtonText: "dark:text-white",
          formFieldLabel: "text-gray-700 dark:text-gray-300",
          formFieldInput:
            "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 dark:text-white",
          dividerLine: "bg-gray-200 dark:bg-gray-600",
          dividerText: "text-gray-500 dark:text-gray-400",
          identityPreviewEditButton:
            "text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300",
          avatarBox: "dark:text-white",
          footerActionLink:
            "text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
} 