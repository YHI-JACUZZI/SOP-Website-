import Link from "next/link";
import AppShell from "@/components/AppShell";
import DashboardHeader from "@/components/DashboardHeader";
import { getMyProfile } from "@/lib/profile";
import { listMySops } from "@/lib/sops";
import { createClient } from "@/lib/supabase/server";
import {
  shortDate, statusFor, STATUS_STYLE,
  type Assignment, type Completion, type Refresher, type View,
} from "@/lib/tracking";

const ORDER = { overdue: 0, refresh: 1, reread: 2, reading: 3, todo: 4, done: 5 } as const;

// My SOPs: every SOP for your role, with where you are on each one.
export default async function MySops() {
  const supabase = await createClient();
  const profile = await getMyProfile();
  const me = profile?.id ?? "";
  const [sops, { data: completions }, { data: views }, { data: assignments }, { data: refreshers }] = await Promise.all([
    listMySops(),
    supabase.from("completions").select("sop_id, person_id, revision, completed_at").eq("person_id", me).returns<Completion[]>(),
    supabase.from("sop_views").select("sop_id, person_id, first_viewed_at, last_viewed_at").eq("person_id", me).returns<View[]>(),
    supabase.from("assignments").select("id, sop_id, person_id, role_id, due_date, refresh_months").returns<Assignment[]>(),
    supabase.from("refreshers").select("sop_id, person_id, revision, score, passed, completed_at").eq("person_id", me).returns<Refresher[]>(),
  ]);
  const sopRows = sops
    .filter((sop) => sop.kind === "sop")
    .map((sop) => ({
      sop,
      ...statusFor({
        sopId: sop.id, revision: sop.revision, personId: me, roleId: profile?.role?.id ?? null,
        completions: completions ?? [], views: views ?? [], assignments: assignments ?? [], refreshers: refreshers ?? [],
      }),
    }))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.due ?? "9").localeCompare(b.due ?? "9") || a.sop.id.localeCompare(b.sop.id));

  return (
    <AppShell profile={profile}>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <DashboardHeader profile={profile} active="mysops" />
        <section className="flex flex-col gap-3">
          {sopRows.length === 0 ? (
            <p className="rounded-lg bg-surface p-4 text-sm text-muted border border-line">No SOPs for your role yet.</p>
          ) : (
            <ul className="stagger flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow)]">
              {sopRows.map(({ sop, status, date, due, nextRefresh }) => (
                <li key={sop.id}>
                  <Link href={`/sops/${sop.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-surface-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-accent">
                        {sop.id}
                        {sop.status === "draft" && <span className="rounded bg-caution-bg px-1.5 py-0.5 text-caution">DRAFT</span>}
                      </span>
                      <span className="font-semibold">{sop.title}</span>
                      <span className="text-xs text-muted">
                        Rev {sop.revision}
                        {sop.department && ` · ${sop.department.name}`}
                        {due && status !== "done" && ` · due ${shortDate(due)}`}
                        {status === "done" && nextRefresh && ` · refresher ${shortDate(nextRefresh)}`}
                      </span>
                    </span>
                    <span className="whitespace-nowrap rounded-md px-2 py-0.5 text-[13px] font-semibold"
                      style={{ background: STATUS_STYLE[status].bg, color: STATUS_STYLE[status].fg }}>
                      {STATUS_STYLE[status].text}
                      {date && ` ${shortDate(date)}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AppShell>
  );
}
