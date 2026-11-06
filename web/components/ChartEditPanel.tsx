"use client";

import type { Edge, Lane, Step } from "@/lib/workflows";

export type Draft = { lanes: Lane[]; edges: Edge[]; steps: Step[] };
export type Version = { id: number; saved_at: string; who: string | null };
type Role = { id: number; name: string; department_id: number | null };
type Department = { id: number; name: string };

const PALETTE = ["sales", "sm", "admin", "prod", "pc", "fm", "wh", "inst", "pm", "roof"];
const label = "text-xs font-semibold uppercase tracking-wide text-muted";
const input = "h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm";
const small = "h-8 rounded-md px-2 text-sm font-semibold ring-1 ring-line disabled:opacity-40";

export const newKey = () => "s" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);

export default function ChartEditPanel({
  draft, setDraft, selKey, setSelKey, sopIds, charts, chartId, roles, departments,
  dirty, saving, message, onSave, onCancel, versions, onRestore,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  selKey: string | null;
  setSelKey: (k: string | null) => void;
  sopIds: string[];
  charts: { id: string; name: string }[];
  chartId: string;
  roles: Role[];
  departments: Department[];
  dirty: boolean;
  saving: boolean;
  message: { ok: boolean; text: string } | null;
  onSave: () => void;
  onCancel: () => void;
  versions: Version[] | null;
  onRestore: (id: number) => void;
}) {
  const step = draft.steps.find((s) => s.key === selKey) ?? null;
  const setStep = (patch: Partial<Step>) =>
    setDraft({ ...draft, steps: draft.steps.map((s) => (s.key === selKey ? { ...s, ...patch } : s)) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <button type="button" onClick={onSave} disabled={!dirty || saving}
          className="h-10 flex-1 rounded-lg bg-[#c25508] font-semibold text-white disabled:opacity-40">
          {saving ? "Saving…" : "Save for everyone"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="h-10 rounded-lg px-4 font-semibold ring-1 ring-line">
          {dirty ? "Discard" : "Done"}
        </button>
      </div>
      {message && (
        <p role="status" className={`rounded-lg p-3 text-sm ${message.ok ? "bg-[#e1f4e8] text-[#12663a]" : "bg-[#fbe4de] text-[#a3290f]"}`}>
          {message.text}
        </p>
      )}
      <button type="button" className={small + " self-start"}
        onClick={() => {
          const key = newKey();
          const col = Math.max(0, ...draft.steps.map((s) => s.col)) + 1;
          setDraft({ ...draft, steps: [...draft.steps, blankStep(key, draft.lanes[0]?.key ?? "", col, 0)] });
          setSelKey(key);
        }}>
        + Add a step
      </button>

      {step ? (
        <StepForm step={step} setStep={setStep} draft={draft} setDraft={setDraft} setSelKey={setSelKey}
          sopIds={sopIds} charts={charts.filter((c) => c.id !== chartId)} />
      ) : (
        <LanesForm draft={draft} setDraft={setDraft} roles={roles} departments={departments} />
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">Version history</summary>
        {versions === null ? (
          <p className="pt-2 text-muted">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="pt-2 text-muted">No earlier versions yet. One is kept every time you save.</p>
        ) : (
          <ul className="flex flex-col gap-1 pt-2">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center gap-2">
                <span className="flex-1 text-muted">
                  {new Date(v.saved_at).toLocaleString()}{v.who && ` · ${v.who}`}
                </span>
                <button type="button" className={small} disabled={saving}
                  onClick={() => { if (window.confirm("Put the chart back to how it was before this save? Your current version is kept in the history.")) onRestore(v.id); }}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>
      <p className="text-xs text-muted">
        Drag a step to move it to another lane or column. Click a step to edit it, or click empty space to edit lanes.
      </p>
    </div>
  );
}

export function blankStep(key: string, lane: string, col: number, row: number): Step {
  return {
    key, label: "New step", type: "step", lane, col, row,
    sop_id: null, drill_id: null, owner_role_id: null, owner_department_id: null, note: null,
  };
}

function StepForm({
  step, setStep, draft, setDraft, setSelKey, sopIds, charts,
}: {
  step: Step;
  setStep: (p: Partial<Step>) => void;
  draft: Draft;
  setDraft: (d: Draft) => void;
  setSelKey: (k: string | null) => void;
  sopIds: string[];
  charts: { id: string; name: string }[];
}) {
  const lane = draft.lanes.find((l) => l.key === step.lane);
  const outs = draft.edges.map((e, i) => ({ e, i })).filter((x) => x.e.from === step.key);
  const others = draft.steps.filter((s) => s.key !== step.key);
  const setEdge = (i: number, patch: Partial<Edge>) =>
    setDraft({ ...draft, edges: draft.edges.map((e, j) => (j === i ? clean({ ...e, ...patch }) : e)) });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Edit step</h3>
        <button type="button" className="text-sm text-accent underline" onClick={() => setSelKey(null)}>Edit lanes instead</button>
      </div>
      <label className="flex flex-col gap-1">
        <span className={label}>Name</span>
        <input className={input} value={step.label} onChange={(e) => setStep({ label: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={label}>Shape</span>
          <select className={input} value={step.type} onChange={(e) => setStep({ type: e.target.value as Step["type"] })}>
            <option value="step">Step</option>
            <option value="decision">Decision</option>
            <option value="terminal">Start / end</option>
            <option value="placeholder">Placeholder</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Lane (owner)</span>
          <select className={input} value={step.lane} onChange={(e) => setStep({ lane: e.target.value, row: 0 })}>
            {draft.lanes.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </label>
      </div>
      {(lane?.rows ?? 1) > 1 && (
        <label className="flex flex-col gap-1">
          <span className={label}>Row in lane</span>
          <select className={input} value={step.row} onChange={(e) => setStep({ row: Number(e.target.value) })}>
            {Array.from({ length: lane?.rows ?? 1 }, (_, i) => <option key={i} value={i}>Row {i + 1}</option>)}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className={label}>SOP ID</span>
        <input className={input} list="sop-ids" placeholder="SOP-PRD-003" value={step.sop_id ?? ""}
          onChange={(e) => setStep({ sop_id: e.target.value.toUpperCase() || null })} />
        <datalist id="sop-ids">{sopIds.map((id) => <option key={id} value={id} />)}</datalist>
      </label>
      <label className="flex flex-col gap-1">
        <span className={label}>Opens detailed chart</span>
        <select className={input} value={step.drill_id ?? ""} onChange={(e) => setStep({ drill_id: e.target.value || null })}>
          <option value="">None</option>
          {charts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={label}>Needs confirming (admins only)</span>
        <input className={input} value={step.note ?? ""} onChange={(e) => setStep({ note: e.target.value || null })} />
      </label>

      <div className="flex flex-col gap-2">
        <span className={label}>Arrows out of this step</span>
        {outs.length === 0 && <p className="text-sm text-muted">None yet.</p>}
        {outs.map(({ e, i }) => (
          <div key={i} className="flex flex-col gap-1 rounded-lg p-2 ring-1 ring-line">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex-1 font-semibold">→ {draft.steps.find((s) => s.key === e.to)?.label ?? e.to}</span>
              <button type="button" className="text-[#a3290f] underline"
                onClick={() => setDraft({ ...draft, edges: draft.edges.filter((_, j) => j !== i) })}>Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className={input} placeholder="Label (Yes, No…)" value={e.label ?? ""} onChange={(ev) => setEdge(i, { label: ev.target.value })} />
              <select className={input} value={e.exit === "bottom" ? "bottom" : e.route ?? ""}
                onChange={(ev) => {
                  const val = ev.target.value;
                  setEdge(i, val === "bottom" ? { exit: "bottom", route: undefined } : { exit: undefined, route: (val || undefined) as Edge["route"] });
                }}>
                <option value="">Auto</option>
                <option value="rv">Right, then down</option>
                <option value="bottom">Down, then right</option>
                <option value="lv">Back left (loop)</option>
                <option value="down-over">Down and over</option>
              </select>
            </div>
          </div>
        ))}
        <select className={input} value="" onChange={(e) => {
          if (!e.target.value) return;
          setDraft({ ...draft, edges: [...draft.edges, { from: step.key, to: e.target.value }] });
        }}>
          <option value="">+ Add an arrow to…</option>
          {others.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={small} onClick={() => {
          const key = newKey();
          setDraft({
            ...draft,
            steps: [...draft.steps, blankStep(key, step.lane, step.col + 1, step.row)],
            edges: [...draft.edges, { from: step.key, to: key }],
          });
          setSelKey(key);
        }}>+ Add a step after this</button>
        <button type="button" className={small + " text-[#a3290f]"} onClick={() => {
          if (!window.confirm(`Delete "${step.label}" and its arrows?`)) return;
          setDraft({
            ...draft,
            steps: draft.steps.filter((s) => s.key !== step.key),
            edges: draft.edges.filter((e) => e.from !== step.key && e.to !== step.key),
          });
          setSelKey(null);
        }}>Delete step</button>
      </div>
    </div>
  );
}

function clean(e: Edge): Edge {
  const out: Edge = { from: e.from, to: e.to };
  if (e.label) out.label = e.label;
  if (e.route) out.route = e.route;
  if (e.exit) out.exit = e.exit;
  return out;
}

function LanesForm({
  draft, setDraft, roles, departments,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  roles: Role[];
  departments: Department[];
}) {
  const lanes = draft.lanes;
  const setLanes = (next: Lane[]) => setDraft({ ...draft, lanes: next });
  const used = (l: Lane) => draft.steps.some((s) => s.lane === l.key);
  const maxRow = (l: Lane) => Math.max(0, ...draft.steps.filter((s) => s.lane === l.key).map((s) => s.row));
  const swap = (i: number, j: number) => { const n = [...lanes]; [n[i], n[j]] = [n[j], n[i]]; setLanes(n); };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">Lanes</h3>
      <p className="text-sm text-muted">Each lane belongs to a role or department, and its steps belong to them too.</p>
      <ul className="flex flex-col gap-2">
        {lanes.map((l, i) => (
          <li key={l.key} className="flex flex-col gap-1 rounded-lg p-2 ring-1 ring-line">
            <div className="flex items-center gap-1">
              <i className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: `var(--r-${l.color})` }} />
              <input className={input} aria-label="Lane name" value={l.label}
                onChange={(e) => setLanes(lanes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            </div>
            <div className="flex flex-wrap items-center gap-1 text-sm">
              <button type="button" className={small} aria-label="Move lane up" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
              <button type="button" className={small} aria-label="Move lane down" disabled={i === lanes.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
              <span className="ml-2 text-muted">Rows</span>
              <button type="button" className={small} disabled={(l.rows ?? 1) <= 1 || maxRow(l) >= (l.rows ?? 1) - 1}
                onClick={() => setLanes(lanes.map((x, j) => (j === i ? { ...x, rows: (x.rows ?? 1) - 1 } : x)))}>−</button>
              <span>{l.rows ?? 1}</span>
              <button type="button" className={small}
                onClick={() => setLanes(lanes.map((x, j) => (j === i ? { ...x, rows: (x.rows ?? 1) + 1 } : x)))}>+</button>
              <div className="flex-1" />
              <button type="button" className="text-[#a3290f] underline disabled:no-underline disabled:opacity-40" disabled={used(l)}
                title={used(l) ? "Move or delete its steps first" : undefined}
                onClick={() => setLanes(lanes.filter((_, j) => j !== i))}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <select className={input} value="" onChange={(e) => {
        const [kind, id] = e.target.value.split(":");
        if (!kind) return;
        const key = (kind === "r" ? "role-" : "dept-") + id;
        const name = kind === "r" ? roles.find((r) => String(r.id) === id)?.name : departments.find((d) => String(d.id) === id)?.name;
        const color = PALETTE.find((c) => !lanes.some((l) => l.color === c)) ?? PALETTE[lanes.length % PALETTE.length];
        const lane: Lane = { key, label: name ?? key, color, ...(kind === "r" ? { role_id: Number(id) } : { department_id: Number(id) }) };
        setLanes([...lanes, lane]);
      }}>
        <option value="">+ Add a lane for…</option>
        <optgroup label="Roles">
          {roles.filter((r) => r.department_id !== null && !lanes.some((l) => l.role_id === r.id)).map((r) => <option key={r.id} value={`r:${r.id}`}>{r.name}</option>)}
        </optgroup>
        <optgroup label="Departments">
          {departments.filter((d) => !lanes.some((l) => l.department_id === d.id)).map((d) => <option key={d.id} value={`d:${d.id}`}>{d.name}</option>)}
        </optgroup>
      </select>
    </div>
  );
}
