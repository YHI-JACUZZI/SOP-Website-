import Link from "next/link";
import DashboardHeader from "@/components/DashboardHeader";
import SignedInBar from "@/components/SignedInBar";
import { fileDocument } from "@/app/library/actions";
import { getMyProfile } from "@/lib/profile";
import { listMySops } from "@/lib/sops";
import { createClient } from "@/lib/supabase/server";
import { isAssigned, shortDate, statusFor, STATUS_STYLE, type Assignment, type Completion, type Refresher } from "@/lib/tracking";

const COPY = {
  handbook: {
    tab: "handbook" as const,
    title: "Employee handbook",
    intro: "Company rules, benefits and how we work. Everyone can read these.",
    empty: "No handbook sections yet.",
  },
  policy: {
    tab: "policies" as const,
    title: "Policies",
    intro: "Company policies. Any your manager assigns to you ask for a signature.",
    empty: "No policies yet.",
  },
};

// The Employee handbook and Policies sections: imported documents filed
// under that heading, with sign-off status for any assigned to you.
export default async function LibrarySection({
  kind, searchParams,
}: {
  kind: "handbook" | "policy";
  searchParams: { error?: string; notice?: string };
}) {
  const copy = COPY[kind];
  const supabase = await createClient();
  const profile = await getMyProfile();
  const me = profile?.id ?? "";
  const roleId = profile?.role?.id ?? null;
  const [docs, { data: completions }, { data: assignments }, { data: refreshers }] = await Promise.all([
    listMySops(),
    supabase.from("completions").select("sop_id, person_id, revision, completed_at").eq("person_id", me).returns<Completion[]>(),
    supabase.from("assignments").select("id, sop_id, person_id, role_id, due_date, refresh_months").returns<Assignment[]>(),
    supabase.from("refreshers").select("sop_id, person_id, revision, score, passed, completed_at").eq("person_id", me).returns<Refresher[]>(),
  ]);
  const A = assignments ?? [];
  const mine = docs.filter((d) => d.kind === kind);
  const isAdmin = !!profile?.role?.is_admin;
  const others = docs.filter((d) => d.kind !== kind);

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={profile} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <DashboardHeader profile={profile} active={copy.tab} />
        <div>
          <h2 className="font-display text-2xl font-bold">{copy.title}</h2>
          <p className="text-muted">{copy.intro}</p>
        </div>
        {searchParams.error && <p role="alert" className="rounded-lg bg-[#fbe4de] p-3 text-sm text-[#a3290f]">{searchParams.error}</p>}
        {searchParams.notice && <p role="status" className="rounded-lg bg-[#e1f4e8] p-3 text-sm text-[#12663a]">{searchParams.notice}</p>}

        {mine.length === 0 ? (
          <p className="rounded-xl bg-surface p-4 text-sm text-muted ring-1 ring-line">{copy.empty}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {mine.map((d) => {
              const assigned = isAssigned(d.id, me, roleId, A);
              const st = assigned
                ? statusFor({ sopId: d.id, revision: d.revision, personId: me, roleId, completions: completions ?? [], views: [], assignments: A, refreshers: refreshers ?? [] })
                : null;
              return (
                <li key={d.id}>
                  <Link href={`/sops/${d.id}`} className="flex h-full flex-col gap-1 rounded-xl bg-surface p-4 ring-1 ring-line hover:ring-accent">
                    <span className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-accent">
                      {d.id}
                      {d.status === "draft" && <span className="rounded bg-[#fff3d6] px-1.5 py-0.5 text-[#6b3f00]">DRAFT</span>}
                    </span>
                    <span className="font-semibold">{d.title}</span>
                    <span className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-muted">
                      Rev {d.revision}
                      {d.for_everyone ? " · Everyone" : d.department && ` · ${d.department.name}`}
                      {st && (
                        <span className="rounded-md px-2 py-0.5 text-[12px] font-semibold" style={{ background: STATUS_STYLE[st.status].bg, color: STATUS_STYLE[st.status].fg }}>
                          {STATUS_STYLE[st.status].text}{st.date && ` ${shortDate(st.date)}`}
                        </span>
                      )}
                    </span>
                  </Link>
                  {isAdmin && (
                    <form action={fileDocument} className="mt-1 text-right">
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="kind" value="sop" />
                      <input type="hidden" name="back" value={kind} />
                      <button type="submit" className="text-xs text-muted underline">Move back to SOPs</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {isAdmin && (
          <form action={fileDocument} className="flex flex-col gap-3 rounded-xl bg-surface p-5 ring-1 ring-line">
            <h3 className="font-display text-lg font-bold">Admins: add a document to {copy.title}</h3>
            <p className="text-sm text-muted">
              First bring the Word file in with <Link href="/admin/import" className="text-accent underline">Import SOP</Link> (an ID
              like {kind === "handbook" ? "SOP-HBK-001" : "SOP-POL-001"} works well), then file it here.
            </p>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="back" value={kind} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Document</span>
              <select name="id" required defaultValue="" className="h-10 rounded-lg border border-line bg-surface px-2 text-sm">
                <option value="" disabled>Choose…</option>
                {others.map((d) => <option key={d.id} value={d.id}>{d.id} · {d.title}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="for_everyone" defaultChecked={kind === "handbook"} className="size-4 accent-[#c25508]" />
              Everyone in the company can open it
            </label>
            <button type="submit" className="h-10 self-start rounded-lg bg-[#c25508] px-5 text-sm font-semibold text-white">Add</button>
          </form>
        )}
      </main>
    </div>
  );
}
