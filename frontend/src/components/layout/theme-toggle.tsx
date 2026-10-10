"use client";

/**
 * ThemeToggle
 * Cycles Light → Dark → System. The preference is stored in localStorage
 * ("procureiq.theme") and applied as <html data-theme="light|dark">.
 * The first paint is handled by the inline script in layout.tsx, so there
 * is no flash of the wrong theme on reload.
 */
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "procureiq.theme";
const CYCLE: ThemePreference[] = ["light", "dark", "system"];

const LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

function readPreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function applyTheme(preference: ThemePreference): void {
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function ThemeToggle() {
  // Safe as a lazy initializer: this component only renders client-side,
  // after the auth gate in AppShell has resolved.
  const [preference, setPreference] =
    useState<ThemePreference>(readPreference);

  useEffect(() => {
    applyTheme(preference);

    if (preference !== "system") {
      return;
    }

    // In "System" mode follow the OS setting live.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");

    media.addEventListener("change", handleChange);

    return () => media.removeEventListener("change", handleChange);
  }, [preference]);

  function cycle() {
    const next = CYCLE[(CYCLE.indexOf(preference) + 1) % CYCLE.length];

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode) — the choice still applies for this session.
    }

    setPreference(next);
  }

  const Icon =
    preference === "light" ? Sun : preference === "dark" ? Moon : Monitor;

  const label = `Theme: ${LABELS[preference]} (click to change)`;

  return (
    <button
      type="button"
      className="icon-button"
      onClick={cycle}
      aria-label={label}
      title={label}
    >
      <Icon size={18} />
    </button>
  );
}
