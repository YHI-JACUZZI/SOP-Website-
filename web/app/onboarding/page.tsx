import Link from "next/link";
import DashboardHeader from "@/components/DashboardHeader";
import SignedInBar from "@/components/SignedInBar";
import { displayName, listPeople } from "@/lib/directory";
import { getMyProfile, PROFILE_FIELDS, type Profile } from "@/lib/profile";
import { listMySops } from "@/lib/sops";
import { createClient } from "@/lib/supabase/server";
import { shortDate } from "@/lib/tracking";
import { addTask, removeTask, saveStartDate, toggleTask } from "./actions";

type Task = {
  id: number; category: string; title: string; owner: "employee" | "manager" | "admin";
  due_days: number; sop_id: string | null; department_id: number | null; role_id: number | null; sort: number;
};
type Progress = { task_id: number; done_at: string; done_by: string | null };
type Target = Profile & { start_date: string | null };

const OWNER = { employee: "New hire", manager: "Manager", admin: "Admin / office" } as const;
const input = "h-10 rounded-lg border border-line bg-surface px-2 text-sm";
const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// Onboarding tracker: progress steps by category and the checklist of tasks,
// for yourself or (managers and admins) for someone on your team.
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; error?: string; notice?: string }>;
}) {
  const { person: personParam, error, notice } = await searchParams;
  const supabase = await createClient();
  const [me, people, docs, { data: tasks }, { data: roles }, { data: departments }] = await Promise.all([
    getMyProfile(),
    listPeople(),
    listMySops(),
    supabase.from("onboarding_tasks").select("*").order("sort").order("id").returns<Task[]>(),
    supabase.from("roles").select("id, name").order("name").returns<{ id: number; name: string }[]>(),
    supabase.from("departments").select("id, name").order("name").returns<{ id: number; name: string }[]>(),
  ]);
  const isAdmin = !!me?.role?.is_admin;
  const leads = isAdmin || !!me?.role?.is_manager;
  // Who managers and admins can look at: admins everyone, managers their department.
  const viewable = leads
    ? people.filter((p) => p.id !== me?.id && (isAdmin || p.department_id === me?.role?.department?.id))
    : [];
  const personId = leads && personParam && viewable.some((p) => p.id === personParam) ? personParam : me?.id ?? "";
  const viewingSelf = personId === me?.id;

  const [{ data: target }, { data: progress }, { data: completions }] = await Promise.all([
    supabase.from("profiles").select(`${PROFILE_FIELDS}, start_date`).eq("id", personId).maybeSingle<Target>(),
    supabase.from("onboarding_progress").select("task_id, done_at, done_by").eq("person_id", personId).returns<Progress[]>(),
    supabase.from("completions").select("sop_id, completed_at").eq("person_id", personId).returns<{ sop_id: string; completed_at: string }[]>(),
  ]);
  const roleId = target?.role?.id ?? null;
  const deptId = target?.role?.department?.id ?? null;
  const mine = (tasks ?? []).filter((t) => (t.role_id === null || t.role_id === roleId) && (t.department_id === null || t.department_id === deptId));
  const P = new Map((progress ?? []).map((p) => [p.task_id, p]));
  const nameOf = (id: string | null) => {
    if (!id) return "someone";
    if (id === me?.id) return "you";
    const p = people.find((x) => x.id === id);
    return p ? displayName(p) : "someone";
  };
  const start = target?.start_date ?? null;

  const rows = mine.map((t) => {
    const ticked = P.get(t.id);
    const viaDoc = t.sop_id ? (completions ?? []).find((c) => c.sop_id === t.sop_id) : undefined;
    const done = ticked ? { at: ticked.done_at, by: nameOf(ticked.done_by) } : viaDoc ? { at: viaDoc.completed_at, by: "signing the document" } : null;
    const due = start ? addDays(start, t.due_days) : null;
    const canTick = !viaDoc && (isAdmin || (leads && !viewingSelf) || (viewingSelf && t.owner === "employee"));
    return { t, done, due, overdue: !done && !!due && due < todayIso(), canTick, auto: !!viaDoc };
  });
  const categories = [...new Set(rows.map((r) => r.t.category))];
  const steps = categories.map((c) => {
    const inCat = rows.filter((r) => r.t.category === c);
    const doneCount = inCat.filter((r) => r.done).length;
    const last = inCat.map((r) => r.done?.at).filter(Boolean).sort().at(-1) ?? null;
    return { name: c, done: doneCount === inCat.length, count: `${doneCount} of ${inCat.length}`, last };
  });
  const doneTotal = rows.filter((r) => r.done).length;
  const pct = rows.length ? Math.round((100 * doneTotal) / rows.length) : 0;
  const allDone = rows.length > 0 && doneTotal === rows.length;
  const who = target ? displayName(target) : "";

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={me} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <DashboardHeader profile={me} active="onboarding" />
        {error && <p role="alert" className="rounded-lg bg-[#fbe4de] p-3 text-sm text-[#a3290f]">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-[#e1f4e8] p-3 text-sm text-[#12663a]">{notice}</p>}

        {leads && (
          <form className="flex flex-wrap items-end gap-3 rounded-xl bg-surface p-4 ring-1 ring-line">
            <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold">Whose onboarding?</span>
              <select name="person" defaultValue={viewingSelf ? "" : personId} className={input}>
                <option value="">Mine</option>
                {viewable.map((p) => (
                  <option key={p.id} value={p.id}>{displayName(p)}{p.role ? ` (${p.role})` : ""}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="h-10 rounded-lg bg-bar px-4 text-sm font-semibold text-white">Show</button>
          </form>
        )}

        {/* Header card, like a profile banner */}
        <section className="overflow-hidden rounded-2xl ring-1 ring-line">
          <div className="flex flex-wrap items-end gap-4 bg-bar px-5 py-5 text-white sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-rule">Onboarding</p>
              <h2 className="font-display text-2xl font-bold">{viewingSelf ? "Your onboarding" : who}</h2>
              <p className="text-sm text-[#d6d2ce]">
                {target?.role?.name ?? "No role yet"}
                {target?.role?.department && ` · ${target.role.department.name}`}
                {start ? ` · Started ${shortDate(start)}` : " · No start date yet"}
              </p>
            </div>
            <div className="flex min-w-48 flex-col gap-1">
              <span className="text-right font-display text-3xl font-extrabold">{pct}%</span>
              <div className="h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Onboarding complete">
                <div className="h-full rounded-full bg-brand-rule" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-right text-xs text-[#d6d2ce]">{doneTotal} of {rows.length} tasks done</span>
            </div>
          </div>
          <div aria-hidden className="h-1 bg-brand-rule" />

          {/* Progress steps */}
          <ol className="flex overflow-x-auto bg-surface px-3 py-6 sm:px-6">
            {[...steps, { name: "All done", done: allDone, count: "", last: null }].map((s, i, all) => (
              <li key={s.name} className="relative flex min-w-28 flex-1 flex-col items-center px-1 text-center">
                {i < all.length - 1 && (
                  <span aria-hidden className={`absolute left-1/2 top-5 h-1 w-full ${s.done ? "bg-[#1f8a4c]" : "bg-line"}`} />
                )}
                <span className={`relative z-10 flex size-10 items-center justify-center rounded-full border-2 font-bold ${
                  s.done ? "border-[#1f8a4c] bg-[#e1f4e8] text-[#12663a]" : "border-line bg-surface text-muted"}`}>
                  {s.done ? "✓" : i + 1}
                </span>
                <span className={`mt-2 text-sm font-semibold leading-tight ${s.done ? "" : "text-muted"}`}>{s.name}</span>
                <span className="text-xs text-muted">{s.done && s.last ? shortDate(s.last) : s.count}</span>
              </li>
            ))}
          </ol>
        </section>

        {leads && !viewingSelf && (
          <form action={saveStartDate} className="flex flex-wrap items-end gap-3 text-sm">
            <input type="hidden" name="person" value={personId} />
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Start date</span>
              <input type="date" name="start_date" defaultValue={start ?? ""} className={input} />
            </label>
            <button type="submit" className="h-10 rounded-lg bg-surface px-4 font-semibold ring-1 ring-line hover:ring-accent">Save</button>
            <span className="pb-2 text-muted">Due dates count from this day.</span>
          </form>
        )}

        {/* Checklist */}
        <section className="flex flex-col overflow-hidden rounded-xl bg-surface ring-1 ring-line">
          <div className="flex items-center justify-between border-b-2 border-[#1f8a4c] px-4 py-3">
            <h2 className="font-display text-lg font-bold">Onboarding tasks</h2>
            {!start && <span className="text-xs text-muted">Due dates show once a start date is set.</span>}
          </div>
          {rows.length === 0 && <p className="p-4 text-sm text-muted">No onboarding tasks yet.</p>}
          {categories.map((c) => (
            <div key={c}>
              <h3 className="bg-background px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{c}</h3>
              <ul className="divide-y divide-line">
                {rows.filter((r) => r.t.category === c).map(({ t, done, due, overdue, canTick, auto }) => {
                  const doc = t.sop_id ? docs.find((d) => d.id === t.sop_id) : null;
                  return (
                    <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                      <form action={toggleTask} className="pt-0.5">
                        <input type="hidden" name="person" value={personId} />
                        <input type="hidden" name="task" value={t.id} />
                        <input type="hidden" name="done" value={done ? "1" : "0"} />
                        <button type="submit" disabled={!canTick}
                          aria-label={`${done ? "Untick" : "Tick"} ${t.title}`}
                          className={`flex size-6 items-center justify-center rounded-md border-2 text-sm font-bold ${
                            done ? "border-[#1f8a4c] bg-[#1f8a4c] text-white" : "border-line bg-surface"
                          } ${canTick ? "cursor-pointer hover:border-accent" : "cursor-default opacity-60"}`}>
                          {done ? "✓" : ""}
                        </button>
                      </form>
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold ${done ? "text-muted line-through" : ""}`}>
                          {doc ? <Link href={`/sops/${doc.id}`} className="text-accent underline">{t.title}</Link> : t.title}
                        </p>
                        <p className="text-sm text-muted">
                          {OWNER[t.owner]}
                          {done
                            ? ` · Completed by ${done.by} on ${shortDate(done.at)}`
                            : due && <span className={overdue ? "font-semibold text-[#a3290f]" : ""}> · {overdue ? "Overdue, was due" : "Due"} {shortDate(due)}</span>}
                          {auto && !done && " · Ticks itself when the document is signed"}
                          {t.sop_id && !doc && !done && ` · ${t.sop_id}`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        {isAdmin && (
          <details className="rounded-xl bg-surface p-5 ring-1 ring-line">
            <summary className="cursor-pointer font-display text-lg font-bold">Edit the onboarding checklist</summary>
            <p className="mt-2 text-sm text-muted">
              These tasks apply to every new hire unless you limit one to a department or role. Removing a task removes it for everyone.
            </p>
            <ul className="mt-3 flex flex-col divide-y divide-line text-sm">
              {(tasks ?? []).map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{t.title}</span>
                    <span className="text-muted">
                      {" "}· {t.category} · {OWNER[t.owner]} · day {t.due_days}
                      {t.department_id && ` · ${departments?.find((d) => d.id === t.department_id)?.name}`}
                      {t.role_id && ` · ${roles?.find((r) => r.id === t.role_id)?.name}`}
                      {t.sop_id && ` · ${t.sop_id}`}
                    </span>
                  </span>
                  <form action={removeTask}>
                    <input type="hidden" name="person" value={personId} />
                    <input type="hidden" name="task" value={t.id} />
                    <button type="submit" className="text-[#a3290f] underline">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={addTask} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="person" value={personId} />
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="font-semibold">Task</span>
                <input name="title" required className={input} placeholder="e.g. Sign the vehicle use policy" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">Group</span>
                <input name="category" list="ob-cats" className={input} placeholder="e.g. New hire paperwork" />
                <datalist id="ob-cats">{[...new Set((tasks ?? []).map((t) => t.category))].map((c) => <option key={c} value={c} />)}</datalist>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">Who does it</span>
                <select name="owner" className={input} defaultValue="employee">
                  {Object.entries(OWNER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">Due (days after start)</span>
                <input name="due_days" type="number" min={0} max={365} defaultValue={7} className={input} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">For</span>
                <select name="scope" className={input} defaultValue="">
                  <option value="">Every new hire</option>
                  <optgroup label="One department">
                    {(departments ?? []).map((d) => <option key={d.id} value={`dept:${d.id}`}>{d.name}</option>)}
                  </optgroup>
                  <optgroup label="One role">
                    {(roles ?? []).map((r) => <option key={r.id} value={`role:${r.id}`}>{r.name}</option>)}
                  </optgroup>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="font-semibold">Linked document (optional, ticks itself once signed)</span>
                <select name="sop_id" className={input} defaultValue="">
                  <option value="">None</option>
                  {docs.map((d) => <option key={d.id} value={d.id}>{d.id} · {d.title}</option>)}
                </select>
              </label>
              <button type="submit" className="h-10 self-end rounded-lg bg-[#c25508] px-5 text-sm font-semibold text-white sm:col-span-2 sm:justify-self-start">
                Add task
              </button>
            </form>
          </details>
        )}
      </main>
    </div>
  );
}

