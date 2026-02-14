"use client";

import { useEffect, useState } from "react";

type ThemeMode = "day" | "night" | "dark";

const modes: ThemeMode[] = ["day", "night", "dark"];

export function ThemeSwitcher() {
  const [mode, setMode] = useState<ThemeMode>("night");

  useEffect(() => {
    const saved = localStorage.getItem("temvy-theme") as ThemeMode | null;
    const next = saved && modes.includes(saved) ? saved : "night";
    document.documentElement.dataset.theme = next;
    setMode(next);
  }, []);

  const applyMode = (next: ThemeMode) => {
    setMode(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("temvy-theme", next);
  };

  return (
    <div className="theme-switcher" role="group" aria-label="Theme mode switcher">
      {modes.map((entry) => (
        <button
          key={entry}
          type="button"
          className={entry === mode ? "theme-btn active" : "theme-btn"}
          onClick={() => applyMode(entry)}
        >
          {entry}
        </button>
      ))}
    </div>
  );
}
