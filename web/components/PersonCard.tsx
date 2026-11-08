import { displayName, initials, type Person } from "@/lib/directory";

export default function PersonCard({ p }: { p: Person }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-surface p-3 ring-1 ring-line">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bar font-display text-sm font-bold text-white">
        {initials(p)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          {displayName(p)}
          {p.is_manager && <span className="rounded bg-[#fff3d6] px-1.5 py-0.5 text-[11px] font-semibold text-[#6b3f00]">Manager</span>}
        </span>
        <span className="text-sm text-muted">{p.role ?? "No role yet"}{p.department && ` · ${p.department}`}</span>
        <a href={`mailto:${p.email}`} className="truncate text-sm text-accent underline">{p.email}</a>
      </span>
    </li>
  );
}
