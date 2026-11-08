import Link from "next/link";
import SignedInBar from "@/components/SignedInBar";
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

  const name = profile?.full_name?.split(" ")[0] || profile?.email;
  const rows = sops
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
  const tiles = [
    { label: "To finish", value: open.length, color: undefined },
    { label: "Overdue", value: count("overdue"), color: count("overdue") ? "#A3290F" : undefined },
    { label: "Refreshers due", value: count("refresh"), color: count("refresh") ? "#1D4E9E" : undefined },
    { label: "Certificates", value: certs.length, color: certs.length ? "#12663A" : undefined },
  ];

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
    { label: "Overdue", value: teamCells.filter((c) => c.status === "overdue").length, color: "#A3290F" },
    { label: "Refreshers due", value: teamCells.filter((c) => c.status === "refresh").length, color: "#1D4E9E" },
    { label: "Signed this week", value: C.filter((c) => c.person_id !== me && c.completed_at >= weekAgo).length, color: "#12663A" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={profile} />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">My dashboard</p>
          <h1 className="font-display text-3xl font-bold">Hi, {name}</h1>
          {profile?.role ? (
            <p className="text-muted">
              {profile.role.name}
              {profile.role.department && ` · ${profile.role.department.name}`}
            </p>
          ) : (
            <p className="mt-2 rounded-lg bg-[#fff3d6] p-4 text-sm text-[#6b3f00]">
              You don&apos;t have a role yet. An admin needs to pick one for you before your SOPs show up.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="flex flex-col gap-1 rounded-xl bg-surface px-4 py-3 ring-1 ring-line">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t.label}</span>
              <span className="font-display text-3xl font-extrabold" style={{ color: t.color }}>{t.value}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-bold">Up next</h2>
              {open.length === 0 ? (
                <p className="rounded-xl bg-[#e1f4e8] p-4 font-semibold text-[#12663a]">
                  {sops.length ? "You're all caught up. Nice work." : "Nothing to do yet."}
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {open.slice(0, 3).map(({ sop, status, due }) => (
                    <li key={sop.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-4 ring-1 ring-line"
                      style={{ borderLeft: `4px solid ${STATUS_STYLE[status].fg}` }}>
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-[11px] tracking-wide text-accent">{sop.id}</span>
                        <p className="font-semibold">{sop.title}</p>
                        <p className="text-sm text-muted">
                          <span style={{ color: STATUS_STYLE[status].fg }} className="font-semibold">{STATUS_STYLE[status].text}</span>
                          {due && ` · due ${shortDate(due)}`}
                        </p>
                      </div>
                      <Link href={`/sops/${sop.id}${status === "refresh" ? "#sign-off" : ""}`}
                        className="flex h-10 items-center rounded-lg bg-[#c25508] px-4 text-sm font-semibold text-white">
                        {ACTION[status]}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-bold">My SOPs</h2>
              {sops.length === 0 ? (
                <p className="rounded-lg bg-surface p-4 text-sm text-muted ring-1 ring-line">No SOPs for your role yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl bg-surface ring-1 ring-line">
                  {rows.map(({ sop, status, date, due, nextRefresh }) => (
                    <li key={sop.id}>
                      <Link href={`/sops/${sop.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-background">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-accent">
                            {sop.id}
                            {sop.status === "draft" && <span className="rounded bg-[#fff3d6] px-1.5 py-0.5 text-[#6b3f00]">DRAFT</span>}
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
              <section className="flex flex-col gap-3 rounded-xl bg-surface p-4 ring-1 ring-line">
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
                <p className="rounded-xl bg-surface p-4 text-sm text-muted ring-1 ring-line">
                  Sign off an assigned SOP and your certificate shows up here.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-line rounded-xl bg-surface ring-1 ring-line">
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

            <Link href="/map" className="flex flex-col gap-1 rounded-xl bg-bar p-4 text-white ring-1 ring-bar hover:ring-accent">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-rule">Company map</span>
              <span className="font-semibold">See where your steps fit in the whole process →</span>
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
