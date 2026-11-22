import Link from "next/link";
import CountUp from "@/components/CountUp";
import DashboardHeader from "@/components/DashboardHeader";
import Icon, { type IconName } from "@/components/Icon";
import QuickStats from "@/components/QuickStats";
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

const KIND_LABEL = { sop: "SOP", handbook: "Handbook", policy: "Policy" } as const;

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
export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "policies" ? "policy" : "sop";
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
  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  const done = rows.length - open.length;
  const firstOverdue = rows.find((r) => r.status === "overdue");
  // Progress split by type: the bars on the first card and the SOPs / Policies tabs.
  const split = (["sop", "policy"] as const).map((kind) => {
    const of = rows.filter((r) => (kind === "policy" ? r.sop.kind === "policy" : r.sop.kind !== "policy"));
    const fin = of.filter((r) => r.status === "done").length;
    return { kind, label: kind === "policy" ? "Policies" : "SOPs", href: kind === "policy" ? "/?tab=policies#my-work" : "/?tab=sops#my-work", done: fin, total: of.length, rows: of };
  });
  const current = split[tab === "policy" ? 1 : 0];
  const tabOpen = current.rows.filter((r) => r.status !== "done");
  const openSops = split[0].total - split[0].done, openPolicies = split[1].total - split[1].done;
  const tiles: { label: string; value: number; icon: IconName; color?: string; note: string }[] = [
    { label: "To finish", value: open.length, icon: "doc", note: rows.length ? `${done} of ${rows.length} done` : "Nothing assigned yet" },
    { label: "Overdue", value: count("overdue"), icon: "clock", color: count("overdue") ? "var(--danger)" : undefined,
      note: firstOverdue ? `${firstOverdue.sop.title}${firstOverdue.due ? `, due ${shortDate(firstOverdue.due)}` : ""}` : "Nothing late" },
    { label: "Refreshers due", value: count("refresh"), icon: "refresh", color: count("refresh") ? "var(--info)" : undefined,
      note: count("refresh") ? "Quick review and quiz" : "None right now" },
    { label: "Certificates", value: certs.length, icon: "award", color: certs.length ? "var(--ok)" : undefined,
      note: certs[0] ? `Latest: ${certs[0].sop?.title ?? certs[0].sop_id}` : "Sign off to earn one" },
  ];
  const summary = [
    open.length
      ? [
          openSops ? `${openSops} SOP${openSops === 1 ? "" : "s"}` : null,
          openPolicies ? `${openPolicies} polic${openPolicies === 1 ? "y" : "ies"}` : null,
        ].filter(Boolean).join(" and ") + " to finish"
      : "All caught up",
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

        <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {tiles.map((t, i) => (
            <div key={t.label} className={`flex min-w-0 flex-col gap-2 rounded-[var(--radius-card)] p-4 sm:px-5 ${
              i === 0 ? "bg-[image:var(--glow-card)] text-white shadow-[var(--glow-shadow)]" : "border border-line bg-surface shadow-[var(--shadow)]"}`}>
              <span className={`flex items-center gap-2 text-sm font-semibold ${i === 0 ? "text-white/90" : "text-muted"}`}>
                <span style={{ color: i === 0 ? undefined : t.color ?? "var(--accent)" }}><Icon name={t.icon} /></span>
                {t.label}
              </span>
              <span className="font-display text-[34px] font-extrabold leading-none" style={{ color: i === 0 ? undefined : t.color }}><CountUp value={t.value} /></span>
              {i === 0 && rows.length > 0 ? (
                <span className="flex flex-col gap-1.5">
                  {split.filter((b) => b.total > 0).map((b) => (
                    <Link key={b.kind} href={b.href} className="flex flex-col gap-1 text-[13px] text-white/90 hover:text-white">
                      <span className="flex justify-between gap-2"><span>{b.label}</span><span>{b.done} of {b.total}</span></span>
                      <span className="h-1.5 rounded-full bg-white/30"><span className="grow-x block h-1.5 rounded-full bg-white" style={{ width: `${Math.round((b.done / b.total) * 100)}%` }} /></span>
                    </Link>
                  ))}
                </span>
              ) : (
                <span className={`truncate text-[13px] ${i === 0 ? "text-white/90" : "text-muted"}`}>{t.note}</span>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-6">
            <section id="my-work" className="scroll-mt-24 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow)]">
              <div className="flex flex-col gap-4 border-b border-line px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-bold">My work</h2>
                  <nav aria-label="SOPs or policies" className="flex overflow-hidden rounded-xl border border-line bg-background p-1 text-sm">
                    {split.map((b) => (
                      <Link key={b.kind} href={b.href} scroll={false} aria-current={b.kind === tab ? "page" : undefined}
                        className={`press rounded-lg px-4 py-1.5 font-semibold ${b.kind === tab ? "bg-ink text-on-ink" : "text-muted hover:text-foreground"}`}>
                        {b.label}
                      </Link>
                    ))}
                  </nav>
                </div>
                <QuickStats key={tab} statuses={current.rows.map((r) => r.status)} compact />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] text-muted">Up next, most urgent first</p>
                  <Link href={tab === "policy" ? "/policies" : "/sops"} className="text-sm font-semibold text-accent hover:underline">
                    {tab === "policy" ? "All policies →" : "All my SOPs →"}
                  </Link>
                </div>
              </div>
              {tabOpen.length === 0 ? (
                <p className="m-4 rounded-xl bg-ok-bg p-4 font-semibold text-ok">
                  {current.rows.length ? "You're all caught up. Nice work." : tab === "policy" ? "No policies assigned to you yet." : "Nothing to do yet."}
                </p>
              ) : (
                <ul className="stagger flex flex-col divide-y divide-line">
                  {tabOpen.slice(0, 4).map(({ sop, status, due }, i) => (
                    <li key={sop.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-ctl)]"
                        style={{ background: STATUS_STYLE[status].bg, color: STATUS_STYLE[status].fg }}>
                        <Icon name={sop.kind === "policy" ? "shield" : "doc"} />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link href={`/sops/${sop.id}`} className="truncate font-semibold hover:text-accent">{sop.title}</Link>
                        <span className="text-[13px] text-muted">
                          {KIND_LABEL[sop.kind] ?? "SOP"} · {sop.id}{sop.department && ` · ${sop.department.name}`}{due && ` · due ${shortDate(due)}`}
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
                  Sign off an assigned SOP or policy and your certificate shows up here.
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
