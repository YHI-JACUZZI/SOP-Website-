"use client";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="h-10 rounded-lg bg-surface px-4 text-sm font-semibold border border-line hover:ring-accent">
      Print or save as PDF
    </button>
  );
}
