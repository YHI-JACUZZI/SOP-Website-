"use client";

import { useState } from "react";
import PendingButton from "@/components/PendingButton";
import { createChart, deleteChart, duplicateChart, saveChartDetails } from "@/app/map/actions";

type Chart = { id: string; name: string; summary: string | null; department_id: number | null; parent_id: string | null };
type Panel = "new" | "copy" | "details" | null;

const field = "h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm";
const label = "text-xs font-semibold uppercase tracking-wide text-muted";
const btn = "h-10 rounded-lg px-4 text-sm font-semibold";

function Who({ departments, value, id }: { departments: { id: number; name: string }[]; value?: number | null; id: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={label}>Who sees it</label>
      <select id={id} name="department_id" defaultValue={value ?? ""} className={field}>
        <option value="">Everyone (company-wide)</option>
        {departments.map((d) => <option key={d.id} value={d.id}>{d.name} department</option>)}
      </select>
    </div>
  );
}

function Under({ charts, value, id, not }: { charts: { id: string; name: string }[]; value?: string | null; id: string; not?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={label}>Sits under</label>
      <select id={id} name="parent_id" defaultValue={value ?? ""} className={field}>
        <option value="">Nothing (top level)</option>
        {charts.filter((c) => c.id !== not).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  );
}

// Admin-only: make a new chart, copy this one, rename it, or delete it.
export default function ChartTools({ chart, charts, departments }: {
  chart: Chart;
  charts: { id: string; name: string }[];
  departments: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState<Panel>(null);
  const tab = (p: Exclude<Panel, null>, text: string) => (
    <button type="button" onClick={() => setOpen(open === p ? null : p)} aria-expanded={open === p}
      className={`${btn} h-9 ring-1 ${open === p ? "bg-bar text-white ring-bar" : "bg-surface ring-line hover:ring-accent"}`}>
      {text}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Admin</span>
        {tab("new", "+ New chart")}
        {tab("copy", "Duplicate this chart")}
        {tab("details", "Rename / settings")}
      </div>

      {open === "new" && (
        <form action={createChart} className="grid gap-3 rounded-xl bg-surface p-4 ring-1 ring-line sm:grid-cols-2 lg:grid-cols-[1.2fr_1.5fr_1fr_1fr_auto] lg:items-end">
          <input type="hidden" name="back" value={chart.id} />
          <div className="flex flex-col gap-1">
            <label htmlFor="nc-name" className={label}>Chart name</label>
            <input id="nc-name" name="name" required minLength={2} placeholder="e.g. Service call" className={field} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="nc-sum" className={label}>One-line description</label>
            <input id="nc-sum" name="summary" className={field} />
          </div>
          <Who id="nc-who" departments={departments} />
          <Under id="nc-under" charts={charts} />
          <PendingButton pendingLabel="Making…" className={`${btn} bg-[#c25508] text-white`}>Make chart</PendingButton>
          <p className="text-xs text-muted sm:col-span-2 lg:col-span-5">
            It starts with a lane for each role in the department (or each department, if everyone sees it) and Start → First step → End. You build the rest with Edit chart.
          </p>
        </form>
      )}

      {open === "copy" && (
        <form action={duplicateChart} className="grid gap-3 rounded-xl bg-surface p-4 ring-1 ring-line sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
          <input type="hidden" name="from" value={chart.id} />
          <div className="flex flex-col gap-1">
            <label htmlFor="dc-name" className={label}>Name for the copy</label>
            <input id="dc-name" name="name" required minLength={2} defaultValue={`${chart.name} (copy)`} className={field} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="dc-sum" className={label}>Description</label>
            <input id="dc-sum" name="summary" defaultValue={chart.summary ?? ""} className={field} />
          </div>
          <PendingButton pendingLabel="Copying…" className={`${btn} bg-[#c25508] text-white`}>Make a copy</PendingButton>
          <p className="text-xs text-muted sm:col-span-3">
            Copies every lane, step, arrow and SOP link into a new chart. &ldquo;{chart.name}&rdquo; stays exactly as it is.
          </p>
        </form>
      )}

      {open === "details" && (
        <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 ring-1 ring-line">
          <form action={saveChartDetails} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.5fr_1fr_1fr_auto] lg:items-end">
            <input type="hidden" name="id" value={chart.id} />
            <div className="flex flex-col gap-1">
              <label htmlFor="cd-name" className={label}>Chart name</label>
              <input id="cd-name" name="name" required minLength={2} defaultValue={chart.name} className={field} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="cd-sum" className={label}>One-line description</label>
              <input id="cd-sum" name="summary" defaultValue={chart.summary ?? ""} className={field} />
            </div>
            <Who id="cd-who" departments={departments} value={chart.department_id} />
            <Under id="cd-under" charts={charts} value={chart.parent_id} not={chart.id} />
            <PendingButton pendingLabel="Saving…" className={`${btn} text-accent ring-1 ring-accent`}>Save</PendingButton>
          </form>
          {chart.id !== "company" && (
            <form action={deleteChart} className="border-t border-line pt-3"
              onSubmit={(e) => { if (!window.confirm(`Delete "${chart.name}" for everyone? Its steps and history go too.`)) e.preventDefault(); }}>
              <input type="hidden" name="id" value={chart.id} />
              <PendingButton pendingLabel="Deleting…" className="text-sm font-semibold text-[#a3290f] underline">Delete this chart</PendingButton>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
