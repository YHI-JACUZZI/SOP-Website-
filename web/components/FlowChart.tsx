"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Edge, Step, Workflow } from "@/lib/workflows";

type SopInfo = { id: string; title: string; revision: string; status: string };
type Role = { id: number; name: string; department_id: number | null };
type Viewer = { roleId: number | null; deptId: number | null };

const HEAD = 16, COLW = 144, ROWH = 112, NW = 130, NH = 74;

const v = (name: string) => `var(--r-${name})`;
const vbg = (name: string) => `var(--r-${name}-bg)`;

function wrap(text: string, max: number) {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(" ")) {
    if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

// Half width and height of a box, used to start and end arrows at its edge.
function half(s: Step) {
  if (s.type === "decision") return { w: 60, h: 42 };
  if (s.type === "terminal") return { w: Math.min(COLW / 2 - 10, Math.max(36, s.label.length * 4.6 + 14)), h: 18 };
  return { w: NW / 2, h: NH / 2 };
}

type Pt = [number, number];
type Pos = { x: number; y: number; s: Step };

// Same arrow routing as the test site, so charts look the same.
function route(A: Pos, B: Pos, o: Edge, vertical: boolean) {
  const ha = half(A.s), hb = half(B.s);
  const tb = (P: Pos, h: { h: number }, down: boolean) => (down ? P.y - h.h : P.y + h.h);
  let pts: Pt[];
  let lx: number | undefined, ly: number | undefined;
  if (o.route === "lv") {
    pts = [[A.x - ha.w, A.y], [B.x, A.y], [B.x, B.y + hb.h]]; lx = B.x + 8; ly = A.y - 8;
  } else if (o.route === "down-over") {
    const my = B.y - hb.h - 22;
    pts = [[A.x, A.y + ha.h], [A.x, my], [B.x, my], [B.x, B.y - hb.h]];
  } else if (A.s.col === B.s.col && Math.abs(A.y - B.y) > 1) {
    const down = B.y > A.y, vx = A.x + (A.s.type === "terminal" ? 0 : 26);
    pts = [[vx, tb(A, ha, !down)], [vx, tb(B, hb, down)]];
  } else if ((vertical || o.route === "rv") && Math.abs(A.y - B.y) > 1) {
    const down = B.y > A.y;
    pts = [[A.x + ha.w, A.y], [B.x, A.y], [B.x, tb(B, hb, down)]];
  } else if (o.exit === "bottom") {
    const sy = A.y + ha.h;
    pts = [[A.x, sy], [A.x, B.y], [B.x - hb.w, B.y]]; lx = A.x + 6; ly = (sy + B.y) / 2;
  } else {
    const sx = A.x + ha.w, ex = B.x - hb.w;
    if (Math.abs(A.y - B.y) < 1) { pts = [[sx, A.y], [ex, A.y]]; lx = (sx + ex) / 2 - 10; ly = A.y - 8; }
    else { const mx = ex - 18; pts = [[sx, A.y], [mx, A.y], [mx, B.y], [ex, B.y]]; lx = sx + 6; ly = A.y - 8; }
  }
  return { pts, lx, ly, label: o.label };
}

// Turn routes into SVG paths, with a small hop where a line crosses another.
function withJumps(routes: { pts: Pt[] }[]) {
  const R = 5;
  const segs = routes.map((r) => r.pts.slice(1).map((q, i) => [r.pts[i], q] as [Pt, Pt]));
  return routes.map((r, ri) => {
    let d = `M${r.pts[0][0]},${r.pts[0][1]}`;
    for (const [P, Q] of segs[ri]) {
      if (Math.abs(P[1] - Q[1]) > 0.5) { d += ` V${Q[1]}`; continue; }
      const y = P[1], dir = Q[0] > P[0] ? 1 : -1, lo = Math.min(P[0], Q[0]), hi = Math.max(P[0], Q[0]);
      const xs = new Set<number>();
      segs.forEach((ss, j) => {
        if (j === ri) return;
        for (const [U, V] of ss) {
          if (Math.abs(U[0] - V[0]) > 0.5) continue;
          const x = U[0], y0 = Math.min(U[1], V[1]), y1 = Math.max(U[1], V[1]);
          if (x > lo + R + 2 && x < hi - R - 2 && y > y0 + 1 && y < y1 - 1) xs.add(x);
        }
      });
      [...xs].sort((m, n) => dir * (m - n)).forEach((x) => {
        d += ` H${x - dir * R} A${R},${R} 0 0 ${dir > 0 ? 1 : 0} ${x + dir * R},${y}`;
      });
      d += ` H${Q[0]}`;
    }
    return d;
  });
}

export default function FlowChart({
  workflow, steps, sops, readableCharts, viewer, roles, isAdmin,
}: {
  workflow: Workflow;
  steps: Step[];
  sops: SopInfo[];
  readableCharts: string[];
  viewer: Viewer;
  roles: Role[];
  isAdmin: boolean;
}) {
  const [selKey, setSelKey] = useState<string | null>(null);
  const [viewAs, setViewAs] = useState<string>("all"); // admins only: preview a role
  const [zoom, setZoom] = useState<number | null>(null); // null = fit the whole chart

  const who: Viewer | null = useMemo(() => {
    if (!isAdmin) return viewer;
    if (viewAs === "all") return null;
    const r = roles.find((x) => String(x.id) === viewAs);
    return r ? { roleId: r.id, deptId: r.department_id } : null;
  }, [isAdmin, viewAs, viewer, roles]);

  const mine = (s: Step) =>
    !who || s.type === "terminal" ||
    (s.owner_role_id !== null && s.owner_role_id === who.roleId) ||
    (s.owner_department_id !== null && s.owner_department_id === who.deptId);

  const geo = useMemo(() => {
    const laneY: Record<string, { y: number; rows: number }> = {};
    let y = 0;
    for (const l of workflow.lanes) { const rows = l.rows || 1; laneY[l.key] = { y, rows }; y += rows * ROWH; }
    const cols = Math.max(0, ...steps.map((s) => s.col)) + 1;
    const W = HEAD + cols * COLW + 4, H = y;
    const pos: Record<string, Pos> = {};
    for (const s of steps) {
      const ly = laneY[s.lane] ?? laneY[workflow.lanes[0]?.key];
      if (!ly) continue;
      pos[s.key] = { x: HEAD + s.col * COLW + COLW / 2, y: ly.y + s.row * ROWH + ROWH / 2 + 12, s };
    }
    const routes = workflow.edges
      .filter((e) => pos[e.from] && pos[e.to])
      .map((e) => route(pos[e.from], pos[e.to], e, workflow.routing === "vertical"));
    return { laneY, W, H, pos, routes, paths: withJumps(routes) };
  }, [workflow, steps]);

  const sopById = new Map(sops.map((s) => [s.id, s]));
  const laneOf = (key: string) => workflow.lanes.find((l) => l.key === key) ?? workflow.lanes[0];
  const sel = steps.find((s) => s.key === selKey) ?? null;
  const myCount = steps.filter((s) => s.type !== "terminal" && s.sop_id && mine(s)).length;
  const written = steps.filter((s) => s.type !== "terminal" && s.sop_id && mine(s) && sopById.has(s.sop_id)).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {isAdmin && (
            <label className="flex items-center gap-2">
              <span className="font-semibold text-muted">Viewing as</span>
              <select value={viewAs} onChange={(e) => setViewAs(e.target.value)}
                className="h-9 rounded-lg border border-line bg-surface px-2">
                <option value="all">Admin (all roles)</option>
                {roles.filter((r) => r.department_id !== null).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
          )}
          <div className="flex-1" />
          <div className="flex overflow-hidden rounded-lg ring-1 ring-line">
            <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, (z ?? 1) - 0.15))}
              className="h-9 w-9 bg-surface font-semibold">−</button>
            <button type="button" onClick={() => setZoom(null)} className="h-9 border-x border-line bg-surface px-3 font-semibold">
              {zoom === null ? "Fit" : `${Math.round(zoom * 100)}%`}
            </button>
            <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2, (z ?? 1) + 0.15))}
              className="h-9 w-9 bg-surface font-semibold">+</button>
          </div>
        </div>

        <div className="overflow-auto rounded-xl bg-surface ring-1 ring-line">
          <svg viewBox={`0 0 ${geo.W} ${geo.H}`} width={zoom === null ? "100%" : geo.W * zoom} height={zoom === null ? undefined : geo.H * zoom} role="img"
            aria-label={`${workflow.name} flowchart`} className="block">
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" style={{ fill: "var(--muted)" }} />
              </marker>
            </defs>
            {workflow.lanes.map((l, i) => {
              const ly = geo.laneY[l.key];
              return (
                <g key={l.key}>
                  <rect x={0} y={ly.y} width={geo.W} height={ly.rows * ROWH} style={{ fill: i % 2 ? "var(--lane-b)" : "var(--lane-a)" }} />
                  <line x1={0} y1={ly.y} x2={geo.W} y2={ly.y} style={{ stroke: "var(--line)" }} />
                  <rect x={0} y={ly.y + 8} width={4} height={ly.rows * ROWH - 16} rx={2} style={{ fill: v(l.color) }} />
                  <text x={14} y={ly.y + 22} className="font-mono text-[13px] font-medium uppercase tracking-wider" style={{ fill: v(l.color) }}>
                    {l.label}
                  </text>
                </g>
              );
            })}
            {geo.paths.map((d, i) => (
              <g key={i}>
                <path d={d} markerEnd="url(#arr)" style={{ fill: "none", stroke: "var(--muted)", strokeWidth: 1.5 }} />
                {geo.routes[i].label && geo.routes[i].lx !== undefined && (
                  <text x={geo.routes[i].lx} y={geo.routes[i].ly} className="font-mono text-[12.5px]" style={{ fill: "var(--muted)" }}>
                    {geo.routes[i].label}
                  </text>
                )}
              </g>
            ))}
            {steps.map((s) => {
              const P = geo.pos[s.key];
              if (!P) return null;
              const c = laneOf(s.lane).color;
              const term = s.type === "terminal";
              const fill = term ? "var(--surface)" : vbg(c);
              const stroke = term ? "var(--muted)" : v(c);
              const width = selKey === s.key ? 3 : 1.5;
              const lines = wrap(s.label, s.type === "decision" ? 10 : 15);
              const tw = half(s).w;
              return (
                <g key={s.key} tabIndex={0} role="button" aria-label={`${s.label}, ${laneOf(s.lane).label}`}
                  onClick={() => setSelKey(s.key)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelKey(s.key); } }}
                  className="cursor-pointer outline-none transition-opacity focus-visible:[&>.shape]:stroke-[3]"
                  style={{ opacity: mine(s) ? 1 : 0.22 }}>
                  {s.type === "decision" ? (
                    <polygon className="shape" points={`${P.x},${P.y - 42} ${P.x + 60},${P.y} ${P.x},${P.y + 42} ${P.x - 60},${P.y}`}
                      style={{ fill, stroke, strokeWidth: width }} />
                  ) : term ? (
                    <rect className="shape" x={P.x - tw} y={P.y - 18} width={tw * 2} height={36} rx={18} style={{ fill, stroke, strokeWidth: width }} />
                  ) : (
                    <>
                      {s.drill_id && (
                        <rect x={P.x - NW / 2 + 5} y={P.y - NH / 2 + 5} width={NW} height={NH} rx={6}
                          style={{ fill, stroke, strokeWidth: 1.5 }} />
                      )}
                      <rect className="shape" x={P.x - NW / 2} y={P.y - NH / 2} width={NW} height={NH} rx={6}
                        strokeDasharray={s.type === "placeholder" ? "5 4" : undefined}
                        style={{ fill, stroke, strokeWidth: width }} />
                    </>
                  )}
                  {lines.map((ln, i) => (
                    <text key={i} x={P.x} y={P.y + (i - (lines.length - 1) / 2) * 17 + 5} textAnchor="middle"
                      className="pointer-events-none text-[15px]" style={{ fill: "var(--foreground)" }}>
                      {ln}
                    </text>
                  ))}
                  {s.note && isAdmin && (
                    <circle cx={P.x + (s.type === "decision" ? 40 : NW / 2 - 8)} cy={P.y - (s.type === "decision" ? 26 : NH / 2 - 8)} r={4}
                      style={{ fill: "var(--warn)" }} />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {workflow.lanes.map((l) => (
            <span key={l.key} className="flex items-center gap-1.5">
              <i className="inline-block h-3 w-3 rounded-sm" style={{ background: v(l.color) }} />{l.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-3 w-3 rounded-sm border-[1.5px] border-muted shadow-[2px_2px_0_var(--muted)]" />
            Has a detailed flowchart
          </span>
          {isAdmin && (
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--warn)" }} />Needs confirming
            </span>
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-3 self-start rounded-xl bg-surface p-5 ring-1 ring-line">
        <h2 className="font-display text-lg font-bold">Step details</h2>
        {!sel ? (
          <>
            <p className="text-sm text-muted">
              Click any step to see who owns it and open its SOP.
              {who && " Your steps are in full colour; the rest are faded."}
            </p>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
              <dt className="text-muted">{who ? "Steps for this role" : "Steps on this chart"}</dt><dd className="font-semibold">{myCount}</dd>
              <dt className="text-muted">SOPs you can open</dt><dd className="font-semibold">{written} of {myCount}</dd>
            </dl>
          </>
        ) : (
          <StepPanel step={sel} lane={laneOf(sel.lane)} sop={sel.sop_id ? sopById.get(sel.sop_id) : undefined}
            canDrill={!!sel.drill_id && readableCharts.includes(sel.drill_id)} isAdmin={isAdmin}
            next={workflow.edges.filter((e) => e.from === sel.key).map((e) => steps.find((x) => x.key === e.to)).filter((x): x is Step => !!x)}
            onPick={setSelKey} />
        )}
      </aside>
    </div>
  );
}

function StepPanel({
  step, lane, sop, canDrill, isAdmin, next, onPick,
}: {
  step: Step;
  lane: { label: string; color: string };
  sop: SopInfo | undefined;
  canDrill: boolean;
  isAdmin: boolean;
  next: Step[];
  onPick: (k: string) => void;
}) {
  return (
    <>
      <h3 className="font-semibold">{step.label}</h3>
      <span className="self-start rounded px-2 py-0.5 text-sm font-semibold" style={{ color: v(lane.color), background: vbg(lane.color) }}>
        {lane.label}
      </span>
      {step.sop_id && (
        sop ? (
          <Link href={`/sops/${sop.id}`} className="flex flex-col rounded-lg p-3 ring-1 ring-line hover:ring-accent">
            <span className="font-mono text-[11px] tracking-wide text-accent">
              {sop.id} · Rev {sop.revision}{sop.status === "draft" && " · DRAFT"}
            </span>
            <span className="font-semibold">{sop.title}</span>
            <span className="text-sm text-accent">Open SOP →</span>
          </Link>
        ) : (
          <p className="text-sm text-muted">
            {step.sop_id}: no SOP you can open yet.
          </p>
        )
      )}
      {canDrill && step.drill_id && (
        <Link href={`/map/${step.drill_id}`} className="h-10 rounded-lg bg-[#c25508] px-4 text-center font-semibold leading-10 text-white">
          Open detailed flowchart
        </Link>
      )}
      {next.length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-muted">Next</span>
          {next.map((n) => (
            <button key={n.key} type="button" onClick={() => onPick(n.key)} className="text-left text-accent underline">
              {n.label}
            </button>
          ))}
        </div>
      )}
      {isAdmin && step.note && (
        <p className="rounded-lg p-3 text-sm" style={{ color: "var(--warn)", background: "var(--warn-bg)" }}>{step.note}</p>
      )}
    </>
  );
}
