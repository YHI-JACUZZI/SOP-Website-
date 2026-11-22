import CountUp from "@/components/CountUp";
import Icon, { type IconName } from "@/components/Icon";
import type { Status } from "@/lib/tracking";

// Quick numbers for a set of assigned documents: assigned, completed, to go.
export function quickCounts(statuses: Status[]) {
  const done = statuses.filter((s) => s === "done").length;
  return {
    assigned: statuses.length,
    done,
    toGo: statuses.length - done,
    overdue: statuses.filter((s) => s === "overdue").length,
    pct: statuses.length ? Math.round((done / statuses.length) * 100) : 0,
  };
}

// Three cards: Assigned (glowing, with a progress bar), Completed and To go.
export default function QuickStats({ statuses, compact = false }: { statuses: Status[]; compact?: boolean }) {
  const n = quickCounts(statuses);
  const tiles: { label: string; value: number; icon: IconName; color?: string; note: string }[] = [
    { label: "Assigned", value: n.assigned, icon: "doc", note: n.assigned ? `${n.pct}% complete` : "Nothing yet" },
    { label: "Completed", value: n.done, icon: "check", color: n.done ? "var(--ok)" : undefined, note: n.done ? "Signed and up to date" : "None yet" },
    { label: "To go", value: n.toGo, icon: "clock", color: n.overdue ? "var(--danger)" : undefined,
      note: n.overdue ? `${n.overdue} overdue` : n.toGo ? "Nothing late" : "All caught up" },
  ];
  return (
    <div className="stagger grid grid-cols-3 gap-3 sm:gap-4">
      {tiles.map((t, i) => (
        <div key={t.label} className={`flex min-w-0 flex-col gap-2 rounded-[var(--radius-card)] ${compact ? "p-3 sm:px-4" : "p-4 sm:px-5"} ${
          i === 0 ? "bg-[image:var(--glow-card)] text-white shadow-[var(--glow-shadow)]" : "border border-line bg-surface shadow-[var(--shadow)]"}`}>
          <span className={`flex items-center gap-2 text-sm font-semibold ${i === 0 ? "text-white/90" : "text-muted"}`}>
            <span style={{ color: i === 0 ? undefined : t.color ?? "var(--accent)" }}><Icon name={t.icon} /></span>
            {t.label}
          </span>
          <span className={`font-display font-extrabold leading-none ${compact ? "text-[28px]" : "text-[34px]"}`} style={{ color: i === 0 ? undefined : t.color }}>
            <CountUp value={t.value} />
          </span>
          {i === 0 && n.assigned > 0 && (
            <span className="h-1.5 rounded-full bg-white/30"><span className="grow-x block h-1.5 rounded-full bg-white" style={{ width: `${n.pct}%` }} /></span>
          )}
          <span className={`truncate text-[13px] ${i === 0 ? "text-white/90" : "text-muted"}`}>{t.note}</span>
        </div>
      ))}
    </div>
  );
}
