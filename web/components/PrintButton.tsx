"use client";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="h-10 rounded-lg bg-surface px-4 text-sm font-semibold ring-1 ring-line hover:ring-accent">
      Print or save as PDF
    </button>
  );
}
