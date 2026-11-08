import Link from "next/link";
import { redirect } from "next/navigation";
import SignedInBar from "@/components/SignedInBar";
import { getMyProfile, PROFILE_FIELDS, type Profile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import {
  isAssigned, shortDate, statusFor, STATUS_STYLE,
  type Assignment, type Completion, type Refresher, type View,
} from "@/lib/tracking";
import { DEFAULT_REFRESH_MONTHS, REFRESH_CHOICES } from "@/lib/signoff";
import { assignSop, removeAssignment } from "./actions";

type Dept = { id: number; name: string };
type Role = { id: number; name: string; department_id: number | null };
type SopRow = { id: string; title: string; revision: string };

const input = "h-10 rounded-lg border border-line bg-surface px-2 text-sm";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; show?: string; error?: string; notice?: string }>;
}) {
  const me = await getMyProfile();
  const isAdmin = !!me?.role?.is_admin;
  if (!me?.role || (!isAdmin && !me.role.is_manager)) redirect("/");
  const { dept: deptParam, show, error, notice } = await searchParams;

  const supabase = await createClient();
  const { data: departments } = await supabase.from("departments").select("id, name").order("name").returns<Dept[]>();
  const depts = departments ?? [];
  // Managers see their own department; admins can pick any.
  const dept = isAdmin
    ? depts.find((d) => String(d.id) === deptParam) ?? depts.find((d) => d.name === "Production") ?? depts[0]
    : depts.find((d) => d.id === me.role!.department?.id);
  if (!dept) redirect("/");

  const [{ data: roles }, { data: people }, { data: sops }, { data: sopRoles }, { data: completions }, { data: views }, { data: assignments }, { data: refreshers }] =
    await Promise.all([
      supabase.from("roles").select("id, name, department_id").eq("department_id", dept.id).order("name").returns<Role[]>(),
      supabase.from("profiles").select(PROFILE_FIELDS).eq("active", true).returns<Profile[]>(),
      supabase.from("sops").select("id, title, revision").eq("department_id", dept.id).eq("status", "published").order("id").returns<SopRow[]>(),
      supabase.from("sop_roles").select("sop_id, role_id").returns<{ sop_id: string; role_id: number }[]>(),
      supabase.from("completions").select("sop_id, person_id, revision, completed_at").returns<Completion[]>(),
      supabase.from("sop_views").select("sop_id, person_id, first_viewed_at, last_viewed_at").returns<View[]>(),
      supabase.from("assignments").select("id, sop_id, person_id, role_id, due_date, refresh_months").order("due_date").returns<Assignment[]>(),
      supabase.from("refreshers").select("sop_id, person_id, revision, score, passed, completed_at").returns<Refresher[]>(),
    ]);

  const deptRoles = roles ?? [];
  const roleIds = new Set(deptRoles.map((r) => r.id));
  const team = (people ?? [])
    .filter((p) => p.role && roleIds.has(p.role.id))
    .sort((a, b) => (a.role!.name + (a.full_name || a.email)).localeCompare(b.role!.name + (b.full_name || b.email)));
  const columns = sops ?? [];
  const C = completions ?? [], V = views ?? [], A = assignments ?? [], R = refreshers ?? [];

  const rows = team.map((p) => {
    const roleId = p.role!.id;
    const cells = columns.map((sop) => {
      const relevant = (sopRoles ?? []).some((r) => r.sop_id === sop.id && r.role_id === roleId) || isAssigned(sop.id, p.id, roleId, A);
      if (!relevant) return null;
      return statusFor({ sopId: sop.id, revision: sop.revision, personId: p.id, roleId, completions: C, views: V, assignments: A, refreshers: R });
    });
    const times = [
      ...V.filter((v) => v.person_id === p.id).map((v) => v.last_viewed_at),
      ...C.filter((c) => c.person_id === p.id).map((c) => c.completed_at),
      ...R.filter((x) => x.person_id === p.id).map((x) => x.completed_at),
    ].sort();
    return { p, cells, last: times.at(-1) ?? null };
  });
  const all = rows.flatMap((r) => r.cells).filter((c) => c !== null);
  // Latest refresher score per person and SOP, averaged: how well people are retaining.
  const scores = all.map((c) => c.score).filter((x): x is number => x !== null);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const stats = [
    { label: "People", value: team.length, color: undefined },
    { label: "SOPs assigned", value: all.length, color: undefined },
    { label: "Completed", value: all.filter((c) => c.status === "done").length, color: "#12663A" },
    { label: "Overdue", value: all.filter((c) => c.status === "overdue").length, color: "#A3290F" },
    { label: "Refreshers due", value: all.filter((c) => c.status === "refresh").length, color: "#1D4E9E" },
    { label: "Avg quiz score", value: avg === null ? "—" : `${avg}%`, color: undefined },
  ];
  const overdueOnly = show === "overdue";
  const shown = overdueOnly ? rows.filter((r) => r.cells.some((c) => c?.status === "overdue")) : rows;
  const q = (extra: Record<string, string>) => {
    const sp = new URLSearchParams({ ...(isAdmin ? { dept: String(dept.id) } : {}), ...extra });
    const s = sp.toString();
    return `/team${s ? `?${s}` : ""}`;
  };
  const deptAssignments = A.filter(
    (a) => columns.some((s) => s.id === a.sop_id) && (a.role_id ? roleIds.has(a.role_id) : team.some((p) => p.id === a.person_id)),
  );
  const who = (a: Assignment) =>
    a.role_id
      ? `Everyone in ${deptRoles.find((r) => r.id === a.role_id)?.name ?? "a role"}`
      : (() => { const p = team.find((x) => x.id === a.person_id); return p?.full_name || p?.email || "Someone"; })();

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={me} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <h1 className="font-display text-3xl font-bold">Team progress</h1>
            <p className="text-muted">{dept.name}</p>
          </div>
          {isAdmin && (
            <nav aria-label="Department" className="flex flex-wrap gap-2 text-sm">
              {depts.map((d) => (
                <Link key={d.id} href={`/team?dept=${d.id}`} aria-current={d.id === dept.id ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 font-semibold ring-1 ${d.id === dept.id ? "bg-bar text-white ring-bar" : "bg-surface ring-line hover:ring-accent"}`}>
                  {d.name}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {error && <p role="alert" className="rounded-lg bg-[#fbe4de] p-3 text-sm text-[#a3290f]">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-[#e1f4e8] p-3 text-sm text-[#12663a]">{notice}</p>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1 rounded-xl bg-surface px-4 py-3 ring-1 ring-line">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">{s.label}</span>
              <span className="font-display text-3xl font-extrabold" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex-1 font-display text-xl font-bold">Who has finished what</h2>
          <div className="flex overflow-hidden rounded-lg text-sm ring-1 ring-line">
            <Link href={q({})} className={`px-3 py-2 font-semibold ${!overdueOnly ? "bg-bar text-white" : "bg-surface"}`}>Everyone</Link>
            <Link href={q({ show: "overdue" })} className={`px-3 py-2 font-semibold ${overdueOnly ? "bg-bar text-white" : "bg-surface"}`}>Overdue only</Link>
          </div>
        </div>

        {team.length === 0 ? (
          <p className="rounded-lg bg-surface p-4 text-sm text-muted ring-1 ring-line">No one in {dept.name} has a login yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-surface ring-1 ring-line">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead className="bg-bar text-left text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Person</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  {columns.map((s) => (
                    <th key={s.id} className="px-4 py-3 font-semibold" title={s.id}>{s.title}</th>
                  ))}
                  <th className="px-4 py-3 font-semibold">Last active</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ p, cells, last }) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-4 py-3 font-semibold">{p.full_name || p.email}</td>
                    <td className="px-4 py-3 text-muted">{p.role!.name}</td>
                    {cells.map((c, i) => (
                      <td key={columns[i].id} className="px-4 py-3">
                        {c ? (
                          <span className="inline-block whitespace-nowrap rounded-md px-2 py-1 text-[13px] font-semibold"
                            style={{ background: STATUS_STYLE[c.status].bg, color: STATUS_STYLE[c.status].fg }}
                            title={c.due ? `Due ${shortDate(c.due)}` : undefined}>
                            {STATUS_STYLE[c.status].text}{c.date && ` ${shortDate(c.date)}`}
                          </span>
                        ) : null}
                        {c?.score != null && (
                          <span className="mt-1 block text-xs text-muted" title="Latest refresher quiz score">Quiz {c.score}%</span>
                        )}
                        {!c && <span className="text-muted">—</span>}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{last ? shortDate(last) : "Never"}</td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={columns.length + 3} className="px-4 py-4 text-muted">Nobody is overdue.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="-mt-3 text-sm text-muted">
          A dash means that SOP isn&apos;t for that person&apos;s role and hasn&apos;t been assigned to them.
        </p>

        <section className="grid gap-6 md:grid-cols-2">
          <form action={assignSop} className="flex flex-col gap-3 rounded-xl bg-surface p-5 ring-1 ring-line">
            <h2 className="font-display text-xl font-bold">Assign an SOP</h2>
            <input type="hidden" name="dept" value={isAdmin ? String(dept.id) : ""} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">SOP</span>
              <select name="sop_id" required className={input} defaultValue="">
                <option value="" disabled>Choose an SOP…</option>
                {columns.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.title}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">For</span>
              <select name="target" required className={input} defaultValue="">
                <option value="" disabled>Choose a role or person…</option>
                <optgroup label="Everyone in a role">
                  {deptRoles.map((r) => <option key={r.id} value={`role:${r.id}`}>{r.name}</option>)}
                </optgroup>
                <optgroup label="One person">
                  {team.map((p) => <option key={p.id} value={`person:${p.id}`}>{p.full_name || p.email} ({p.role!.name})</option>)}
                </optgroup>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Due date (optional)</span>
              <input type="date" name="due_date" className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Refresher</span>
              <select name="refresh_months" className={input} defaultValue={String(DEFAULT_REFRESH_MONTHS)}>
                <option value="">No refresher</option>
                {REFRESH_CHOICES.map((m) => <option key={m} value={m}>Every {m === 1 ? "month" : `${m} months`}</option>)}
              </select>
              <span className="text-xs text-muted">After signing, they review the SOP, take its quiz and sign again this often.</span>
            </label>
            <button type="submit" className="h-11 rounded-lg bg-[#c25508] font-semibold text-white">Assign</button>
          </form>

          <div className="flex flex-col gap-3 rounded-xl bg-surface p-5 ring-1 ring-line">
            <h2 className="font-display text-xl font-bold">Current assignments</h2>
            {deptAssignments.length === 0 ? (
              <p className="text-sm text-muted">None yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line text-sm">
                {deptAssignments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2">
                    <span className="flex-1">
                      <span className="font-semibold">{columns.find((s) => s.id === a.sop_id)?.title ?? a.sop_id}</span>
                      <span className="text-muted"> · {who(a)}{a.due_date ? ` · due ${shortDate(a.due_date)}` : ""}{a.refresh_months ? ` · refresher every ${a.refresh_months === 1 ? "month" : `${a.refresh_months} months`}` : ""}</span>
                    </span>
                    <form action={removeAssignment}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="dept" value={isAdmin ? String(dept.id) : ""} />
                      <button type="submit" className="text-[#a3290f] underline">Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
