import Link from "next/link";
import AppShell from "@/components/AppShell";
import DashboardHeader from "@/components/DashboardHeader";
import QuickStats from "@/components/QuickStats";
import { getMyProfile } from "@/lib/profile";
import { listMySops } from "@/lib/sops";
import { createClient } from "@/lib/supabase/server";
import {
  isAssigned, shortDate, statusFor, STATUS_STYLE,
  type Assignment, type Completion, type Refresher, type View,
} from "@/lib/tracking";

const ORDER = { overdue: 0, refresh: 1, reread: 2, reading: 3, todo: 4, done: 5 } as const;

const COPY = {
  sop: { tab: "mysops" as const, noun: "SOP", empty: "No SOPs for your role yet." },
  policy: { tab: "policies" as const, noun: "policy", empty: "No policies have been assigned to you yet." },
};

// My SOPs and My Policies: the documents you need to finish, with quick
// numbers on top (assigned, completed, to go) and where you are on each one.
// SOPs count when they're for your role; policies count once they're assigned.
export default async function MyDocsPage({ kind }: { kind: "sop" | "policy" }) {
  const copy = COPY[kind];
  const supabase = await createClient();
  const profile = await getMyProfile();
  const me = profile?.id ?? "";
  const roleId = profile?.role?.id ?? null;
  const [docs, { data: completions }, { data: views }, { data: assignments }, { data: refreshers }] = await Promise.all([
    listMySops(),
    supabase.from("completions").select("sop_id, person_id, revision, completed_at").eq("person_id", me).returns<Completion[]>(),
    supabase.from("sop_views").select("sop_id, person_id, first_viewed_at, last_viewed_at").eq("person_id", me).returns<View[]>(),
    supabase.from("assignments").select("id, sop_id, person_id, role_id, due_date, refresh_months").returns<Assignment[]>(),
    supabase.from("refreshers").select("sop_id, person_id, revision, score, passed, completed_at").eq("person_id", me).returns<Refresher[]>(),
  ]);
  const A = assignments ?? [];
  const rows = docs
    .filter((d) => d.kind === kind && (kind === "sop" || isAssigned(d.id, me, roleId, A)))
    .map((doc) => ({
      doc,
      ...statusFor({
        sopId: doc.id, revision: doc.revision, personId: me, roleId,
        completions: completions ?? [], views: views ?? [], assignments: A, refreshers: refreshers ?? [],
      }),
    }))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.due ?? "9").localeCompare(b.due ?? "9") || a.doc.id.localeCompare(b.doc.id));

  return (
    <AppShell profile={profile}>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <DashboardHeader profile={profile} active={copy.tab} />

        <QuickStats statuses={rows.map((r) => r.status)} />

        <section className="flex flex-col gap-3">
          {rows.length === 0 ? (
            <p className="rounded-lg bg-surface p-4 text-sm text-muted border border-line">{copy.empty}</p>
          ) : (
            <ul className="stagger flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow)]">
              {rows.map(({ doc, status, date, due, nextRefresh }) => (
                <li key={doc.id}>
                  <Link href={`/sops/${doc.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-surface-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-accent">
                        {doc.id}
                        {doc.status === "draft" && <span className="rounded bg-caution-bg px-1.5 py-0.5 text-caution">DRAFT</span>}
                      </span>
                      <span className="font-semibold">{doc.title}</span>
                      <span className="text-xs text-muted">
                        Rev {doc.revision}
                        {doc.for_everyone ? " · Everyone" : doc.department && ` · ${doc.department.name}`}
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
          {kind === "policy" && (
            <p className="text-sm text-muted">
              Looking for a policy that isn&apos;t assigned to you? <Link href="/policies" className="font-semibold text-accent underline">See all company policies</Link>.
            </p>
          )}
        </section>
      </main>
    </AppShell>
  );
}
