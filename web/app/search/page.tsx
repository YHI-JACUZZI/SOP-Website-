import Link from "next/link";
import DashboardHeader from "@/components/DashboardHeader";
import PersonCard from "@/components/PersonCard";
import SignedInBar from "@/components/SignedInBar";
import { listPeople } from "@/lib/directory";
import { getMyProfile } from "@/lib/profile";
import { listMySops } from "@/lib/sops";
import { createClient } from "@/lib/supabase/server";
import { listMyWorkflows } from "@/lib/workflows";

const KIND_LABEL = { sop: "SOP", handbook: "Handbook", policy: "Policy" } as const;

// One search across the documents, people and chart steps this person can see.
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const needle = q.trim().toLowerCase().slice(0, 80);
  const supabase = await createClient();
  const [profile, docs, people, charts, { data: steps }] = await Promise.all([
    getMyProfile(), listMySops(), listPeople(), listMyWorkflows(),
    needle
      ? supabase.from("workflow_steps").select("workflow_id, key, label, sop_id")
          .ilike("label", `%${needle.replace(/[%_\\]/g, (c) => `\\${c}`)}%`).limit(20)
          .returns<{ workflow_id: string; key: string; label: string; sop_id: string | null }[]>()
      : Promise.resolve({ data: [] }),
  ]);
  const has = (...v: (string | null | undefined)[]) => v.some((x) => x?.toLowerCase().includes(needle));
  const docHits = needle ? docs.filter((d) => has(d.id, d.title, d.department?.name)) : [];
  const peopleHits = needle ? people.filter((p) => has(p.full_name, p.email, p.role, p.department)) : [];
  const chartName = (id: string) => charts.find((c) => c.id === id)?.name ?? id;
  const chartHits = needle ? charts.filter((c) => has(c.name)) : [];
  const stepHits = steps ?? [];
  const total = docHits.length + peopleHits.length + chartHits.length + stepHits.length;

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={profile} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <DashboardHeader profile={profile} active="search" q={q} />
        {!needle ? (
          <p className="rounded-xl bg-surface p-4 text-sm text-muted ring-1 ring-line">
            Search SOPs, the handbook, policies, people and the steps on the process charts. Try a name, an SOP ID or a word like “install”.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted" role="status">
              {total === 0 ? `Nothing found for “${q}”.` : `${total} result${total === 1 ? "" : "s"} for “${q}”`}
            </p>
            {docHits.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="font-display text-xl font-bold">Documents</h2>
                <ul className="flex flex-col divide-y divide-line rounded-xl bg-surface ring-1 ring-line">
                  {docHits.map((d) => (
                    <li key={d.id}>
                      <Link href={`/sops/${d.id}`} className="flex flex-wrap items-baseline gap-x-3 px-4 py-3 hover:bg-background">
                        <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">{KIND_LABEL[d.kind] ?? "SOP"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-[11px] tracking-wide text-accent">{d.id}</span>
                          <span className="font-semibold">{d.title}</span>
                        </span>
                        {d.department && <span className="text-sm text-muted">{d.department.name}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {(stepHits.length > 0 || chartHits.length > 0) && (
              <section className="flex flex-col gap-3">
                <h2 className="font-display text-xl font-bold">On the process charts</h2>
                <ul className="flex flex-col divide-y divide-line rounded-xl bg-surface ring-1 ring-line">
                  {chartHits.map((c) => (
                    <li key={c.id}>
                      <Link href={`/map/${c.id}`} className="flex gap-3 px-4 py-3 hover:bg-background">
                        <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">Chart</span>
                        <span className="font-semibold">{c.name}</span>
                      </Link>
                    </li>
                  ))}
                  {stepHits.map((s) => (
                    <li key={`${s.workflow_id}-${s.key}`}>
                      <Link href={`/map/${s.workflow_id}`} className="flex flex-wrap gap-x-3 px-4 py-3 hover:bg-background">
                        <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">Step</span>
                        <span className="min-w-0 flex-1 font-semibold">{s.label}</span>
                        <span className="text-sm text-muted">{chartName(s.workflow_id)}{s.sop_id && ` · ${s.sop_id}`}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {peopleHits.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="font-display text-xl font-bold">People</h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {peopleHits.map((p) => <PersonCard key={p.id} p={p} />)}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
