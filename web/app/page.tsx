import Link from "next/link";
import DashboardHeader from "@/components/DashboardHeader";
import Icon, { type IconName } from "@/components/Icon";
import AppShell from "@/components/AppShell";
import { getMyProfile, PROFILE_FIELDS, type Profile } from "@/lib/profile";
import { listMySops } from "@/lib/sops";
import { createClient } from "@/lib/supabase/server";
import { certNumber } from "@/lib/signoff";
import {
  isAssigned, shortDate, statusFor, STATUS_STYLE,
  type Assignment, type Completion, type Refresher, type Status, type View,
} from "@/lib/tracking";

type Cert = { sop_id: string; revision: string; completed_at: string; certificate_id: string; sop: { title: string } | null };

const ORDER = { overdue: 0, refresh: 1, reread: 2, reading: 3, todo: 4, done: 5 } as const;

// What the button on an "Up next" item says.
const ACTION: Record<Status, string> = {
  overdue: "Finish now",
  refresh: "Take refresher",
  reread: "Read the changes",
  reading: "Keep reading",
  todo: "Start",
  done: "Open",
};

// My dashboard: the signed-in person's own work, certificates and (for
// managers and admins) a snapshot of their team.
export default async function Home() {
  const supabase = await createClient();
  const profile = await getMyProfile();
  const me = profile?.id ?? "";
  const leads = !!(profile?.role?.is_admin || profile?.role?.is_manager);
  // Managers and admins read their team's rows too (the database limits it);
  // everyone else only ever gets their own.
  const [sops, { data: completions }, { data: views }, { data: assignments }, { data: refreshers }, { data: signed }, { data: passed }, { data: people }] =
    await Promise.all([
      listMySops(),
      supabase.from("completions").select("sop_id, person_id, revision, completed_at").returns<Completion[]>(),
      supabase.from("sop_views").select("sop_id, person_id, first_viewed_at, last_viewed_at").eq("person_id", me).returns<View[]>(),
      supabase.from("assignments").select("id, sop_id, person_id, role_id, due_date, refresh_months").returns<Assignment[]>(),
      supabase.from("refreshers").select("sop_id, person_id, revision, score, passed, completed_at").returns<Refresher[]>(),
      supabase.from("completions").select("sop_id, revision, completed_at, certificate_id, sop:sops(title)")
        .eq("person_id", me).not("signed_name", "is", null).returns<Cert[]>(),
      supabase.from("refreshers").select("sop_id, revision, completed_at, certificate_id, sop:sops(title)")
        .eq("person_id", me).eq("passed", true).returns<Cert[]>(),
      leads
        ? supabase.from("profiles").select(PROFILE_FIELDS).eq("active", true).neq("id", me).returns<Profile[]>()
        : Promise.resolve({ data: [] as Profile[] }),
    ]);
  const C = completions ?? [], A = assignments ?? [], R = refreshers ?? [];
  const certs = [
    ...(signed ?? []).map((c) => ({ ...c, kind: "Sign-off" })),
    ...(passed ?? []).map((c) => ({ ...c, kind: "Refresher" })),
  ].sort((a, b) => b.completed_at.localeCompare(a.completed_at));

  // Your work: SOPs for your role, plus any handbook section or policy assigned to you.
  const rows = sops
    .filter((sop) => sop.kind === "sop" || isAssigned(sop.id, me, profile?.role?.id ?? null, A))
    .map((sop) => ({
      sop,
      ...statusFor({
        sopId: sop.id, revision: sop.revision, personId: me, roleId: profile?.role?.id ?? null,
        completions: C, views: views ?? [], assignments: A, refreshers: R,
      }),
    }))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.due ?? "9").localeCompare(b.due ?? "9") || a.sop.id.localeCompare(b.sop.id));
  const open = rows.filter((r) => r.status !== "done");
  const sopRows = rows.filter((r) => r.sop.kind === "sop");
  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  const done = rows.length - open.length;
  const firstOverdue = rows.find((r) => r.status === "overdue");
  const tiles: { label: string; value: number; icon: IconName; color?: string; note: string }[] = [
    { label: "To finish", value: open.length, icon: "doc", note: rows.length ? `${done} of ${rows.length} done` : "Nothing assigned yet" },
    { label: "Overdue", value: count("overdue"), icon: "clock", color: count("overdue") ? "var(--danger)" : undefined,
      note: firstOverdue ? `${firstOverdue.sop.title}${firstOverdue.due ? `, due ${shortDate(firstOverdue.due)}` : ""}` : "Nothing late" },
    { label: "Refreshers due", value: count("refresh"), icon: "refresh", color: count("refresh") ? "var(--info)" : undefined,
      note: count("refresh") ? "Quick review and quiz" : "None right now" },
    { label: "Certificates", value: certs.length, icon: "award", color: certs.length ? "var(--ok)" : undefined,
      note: certs[0] ? `Latest: ${certs[0].sop?.title ?? certs[0].sop_id}` : "Sign off an SOP to earn one" },
  ];
  const summary = [
    open.length ? `${open.length} SOP${open.length === 1 ? "" : "s"} to finish` : "All caught up",
    count("overdue") ? `${count("overdue")} overdue` : null,
    certs.length ? `${certs.length} certificate${certs.length === 1 ? "" : "s"} earned` : null,
  ].filter(Boolean).join(" · ");

  // Team snapshot: everything assigned to the people this person can see.
  const team = (people ?? []).filter((p) => p.role);
  const teamCells = leads
    ? team.flatMap((p) =>
        sops
          .filter((s) => isAssigned(s.id, p.id, p.role!.id, A))
          .map((s) => statusFor({ sopId: s.id, revision: s.revision, personId: p.id, roleId: p.role!.id, completions: C, views: [], assignments: A, refreshers: R })),
      )
    : [];
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const teamStats = [
    { label: "Overdue", value: teamCells.filter((c) => c.status === "overdue").length, color: "var(--danger)" },
    { label: "Refreshers due", value: teamCells.filter((c) => c.status === "refresh").length, color: "var(--info)" },
    { label: "Signed this week", value: C.filter((c) => c.person_id !== me && c.completed_at >= weekAgo).length, color: "var(--ok)" },
  ];

  return (
    <AppShell profile={profile}>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <DashboardHeader profile={profile} active="sops" summary={summary} />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {tiles.map((t, i) => (
            <div key={t.label} className={`flex min-w-0 flex-col gap-2 rounded-[var(--radius-card)] p-4 sm:px-5 ${
              i === 0 ? "bg-[image:var(--glow-card)] text-white shadow-[var(--glow-shadow)]" : "border border-line bg-surface shadow-[var(--shadow)]"}`}>
              <span className={`flex items-center gap-2 text-sm font-semibold ${i === 0 ? "text-white/90" : "text-muted"}`}>
                <span style={{ color: i === 0 ? undefined : t.color ?? "var(--accent)" }}><Icon name={t.icon} /></span>
                {t.label}
              </span>
              <span className="font-display text-[34px] font-extrabold leading-none" style={{ color: i === 0 ? undefined : t.color }}>{t.value}</span>
              {i === 0 && rows.length > 0 && (
                <span className="h-1.5 rounded-full bg-white/30"><span className="block h-1.5 rounded-full bg-white" style={{ width: `${Math.round((done / rows.length) * 100)}%` }} /></span>
              )}
              <span className={`truncate text-[13px] ${i === 0 ? "text-white/90" : "text-muted"}`}>{t.note}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-6">
            <section className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow)]">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <h2 className="font-display text-lg font-bold">Up next</h2>
                  <p className="text-[13px] text-muted">Most urgent first</p>
                </div>
              </div>
              {open.length === 0 ? (
                <p className="m-4 rounded-xl bg-ok-bg p-4 font-semibold text-ok">
                  {rows.length ? "You're all caught up. Nice work." : "Nothing to do yet."}
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {open.slice(0, 4).map(({ sop, status, due }, i) => (
                    <li key={sop.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-ctl)]"
                        style={{ background: STATUS_STYLE[status].bg, color: STATUS_STYLE[status].fg }}>
                        <Icon name="doc" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link href={`/sops/${sop.id}`} className="truncate font-semibold hover:text-accent">{sop.title}</Link>
                        <span className="text-[13px] text-muted">
                          {sop.id}{sop.department && ` · ${sop.department.name}`}{due && ` · due ${shortDate(due)}`}
                        </span>
                      </div>
                      <div className="flex w-full items-center justify-between gap-3 pl-15 sm:w-auto sm:pl-0">
                        <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{ background: STATUS_STYLE[status].bg, color: STATUS_STYLE[status].fg }}>
                          {STATUS_STYLE[status].text}
                        </span>
                        <Link href={`/sops/${sop.id}${status === "refresh" ? "#sign-off" : ""}`}
                          className={`press flex h-10 items-center rounded-[var(--radius-ctl)] px-4 text-sm font-semibold ${
                            i === 0 ? "bg-btn text-white hover:bg-btn-hover" : "border border-line hover:border-accent hover:text-accent"}`}>
                          {ACTION[status]}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-bold">My SOPs</h2>
              {sopRows.length === 0 ? (
                <p className="rounded-lg bg-surface p-4 text-sm text-muted border border-line">No SOPs for your role yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow)]">
                  {sopRows.map(({ sop, status, date, due, nextRefresh }) => (
                    <li key={sop.id}>
                      <Link href={`/sops/${sop.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-background">
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
          </div>

          <aside className="flex flex-col gap-6">
            {leads && (
              <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow)]">
                <h2 className="font-display text-lg font-bold">
                  {profile?.role?.is_admin ? "Company" : "My team"}
                </h2>
                <dl className="grid grid-cols-3 gap-2">
                  {teamStats.map((s) => (
                    <div key={s.label} className="flex flex-col">
                      <dt className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted">{s.label}</dt>
                      <dd className="font-display text-2xl font-extrabold" style={{ color: s.value ? s.color : undefined }}>{s.value}</dd>
                    </div>
                  ))}
                </dl>
                <Link href="/team" className="text-sm font-semibold text-accent underline">Team progress and assigning →</Link>
              </section>
            )}

            <section className="flex flex-col gap-3">
              <h2 className="font-display text-lg font-bold">My certificates</h2>
              {certs.length === 0 ? (
                <p className="rounded-xl bg-surface p-4 text-sm text-muted border border-line">
                  Sign off an assigned SOP and your certificate shows up here.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow)]">
                  {certs.map((c) => (
                    <li key={c.certificate_id}>
                      <Link href={`/certificates/${c.certificate_id}`} className="flex flex-col px-4 py-2.5 hover:bg-background">
                        <span className="font-semibold">{c.sop?.title ?? c.sop_id}</span>
                        <span className="text-xs text-muted">
                          {c.kind} · Rev {c.revision} · {shortDate(c.completed_at)}
                          <span className="sr-only"> · certificate {certNumber(c.certificate_id)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Link href="/map" className="lift flex flex-col gap-2 rounded-[var(--radius-card)] border border-white/10 bg-[#121110] p-5 text-white">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#f68c3a]">Company map</span>
              <span className="font-display text-lg font-bold leading-snug">See where your steps fit in the whole job</span>
              <span className="text-sm font-semibold text-white/80">Open the map →</span>
            </Link>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
