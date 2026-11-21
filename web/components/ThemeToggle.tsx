"use client";

import Icon from "@/components/Icon";

// Sun/moon button. Remembers each person's pick for a year in a cookie, so the
// page is drawn in the right colours straight away next time.
export default function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current = root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <button type="button" onClick={toggle} aria-label="Switch between light and dark mode" title="Light or dark mode"
      className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-foreground hover:border-accent hover:text-accent">
      {/* Shows a moon in light mode and a sun in dark mode. */}
      <span className="logo-light"><Icon name="moon" /></span>
      <span className="logo-dark"><Icon name="sun" /></span>
    </button>
  );
}
