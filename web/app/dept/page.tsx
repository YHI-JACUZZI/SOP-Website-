import Link from "next/link";
import DashboardHeader from "@/components/DashboardHeader";
import PersonCard from "@/components/PersonCard";
import SignedInBar from "@/components/SignedInBar";
import { listPeople } from "@/lib/directory";
import { getMyProfile } from "@/lib/profile";
import { listMySops } from "@/lib/sops";
import { createClient } from "@/lib/supabase/server";
import { listMyWorkflows } from "@/lib/workflows";

// My department: who's in it, its managers, its SOPs and its process chart.
export default async function DeptPage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const { dept: deptParam } = await searchParams;
  const supabase = await createClient();
  const [profile, people, sops, charts, { data: departments }] = await Promise.all([
    getMyProfile(), listPeople(), listMySops(), listMyWorkflows(),
    supabase.from("departments").select("id, name").order("name").returns<{ id: number; name: string }[]>(),
  ]);
  const depts = departments ?? [];
  const isAdmin = !!profile?.role?.is_admin;
  // Admins don't belong to a department, so they can look at any of them.
  const dept = isAdmin
    ? depts.find((d) => String(d.id) === deptParam) ?? depts.find((d) => d.name === "Production") ?? depts[0]
    : profile?.role?.department ?? null;

  const team = dept ? people.filter((p) => p.department_id === dept.id) : [];
  const managers = team.filter((p) => p.is_manager);
  const others = team.filter((p) => !p.is_manager);
  const deptSops = dept ? sops.filter((s) => s.department?.name === dept.name && s.kind === "sop") : [];
  const deptCharts = dept ? charts.filter((c) => c.department?.name === dept.name) : [];

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={profile} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <DashboardHeader profile={profile} active="dept" />
        {isAdmin && (
          <nav aria-label="Department" className="flex flex-wrap gap-2 text-sm">
            {depts.map((d) => (
              <Link key={d.id} href={`/dept?dept=${d.id}`} aria-current={d.id === dept?.id ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 font-semibold ring-1 ${d.id === dept?.id ? "bg-bar text-white ring-bar" : "bg-surface ring-line hover:ring-accent"}`}>
                {d.name}
              </Link>
            ))}
          </nav>
        )}
        {!dept ? (
          <p className="rounded-lg bg-surface p-4 text-sm text-muted ring-1 ring-line">You&apos;re not in a department yet.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-6">
              <section className="flex flex-col gap-3">
                <h2 className="font-display text-2xl font-bold">{dept.name}</h2>
                {managers.length > 0 && (
                  <>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{managers.length > 1 ? "Managers" : "Manager"}</h3>
                    <ul className="grid gap-3 sm:grid-cols-2">{managers.map((p) => <PersonCard key={p.id} p={p} />)}</ul>
                  </>
                )}
                <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Team ({others.length})</h3>
                {others.length === 0 ? (
                  <p className="text-sm text-muted">No one else has a login yet.</p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">{others.map((p) => <PersonCard key={p.id} p={p} />)}</ul>
                )}
              </section>
            </div>
            <aside className="flex flex-col gap-6">
              <section className="flex flex-col gap-3">
                <h2 className="font-display text-lg font-bold">{dept.name} SOPs</h2>
                {deptSops.length === 0 ? (
                  <p className="rounded-xl bg-surface p-4 text-sm text-muted ring-1 ring-line">None you can open yet.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line rounded-xl bg-surface ring-1 ring-line">
                    {deptSops.map((s) => (
                      <li key={s.id}>
                        <Link href={`/sops/${s.id}`} className="flex flex-col px-4 py-2.5 hover:bg-background">
                          <span className="font-mono text-[11px] tracking-wide text-accent">{s.id}</span>
                          <span className="font-semibold">{s.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {deptCharts.map((c) => (
                <Link key={c.id} href={`/map/${c.id}`} className="flex flex-col gap-1 rounded-xl bg-bar p-4 text-white ring-1 ring-bar hover:ring-accent">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-rule">Process chart</span>
                  <span className="font-semibold">{c.name} →</span>
                </Link>
              ))}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
