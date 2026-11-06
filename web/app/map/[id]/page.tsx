import Link from "next/link";
import { notFound } from "next/navigation";
import FlowChart from "@/components/FlowChart";
import SignedInBar from "@/components/SignedInBar";
import { getMyProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { getWorkflow, listMyWorkflows } from "@/lib/workflows";

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [profile, chart, charts, { data: sops }, { data: roles }] = await Promise.all([
    getMyProfile(),
    getWorkflow(id),
    listMyWorkflows(),
    // The database only returns SOPs this person may open.
    supabase.from("sops").select("id, title, revision, status").neq("status", "archived"),
    supabase.from("roles").select("id, name, department_id").order("name"),
  ]);
  // Not found and not allowed look the same.
  if (!chart) notFound();
  const { workflow, steps } = chart;
  const parent = charts.find((c) => c.id === workflow.parent_id);
  const isAdmin = !!profile?.role?.is_admin;

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={profile} />
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <nav aria-label="Charts" className="flex flex-wrap gap-2 text-sm">
          {charts.map((c) => (
            <Link key={c.id} href={`/map/${c.id}`} aria-current={c.id === workflow.id ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 font-semibold ring-1 ${
                c.id === workflow.id ? "bg-bar text-white ring-bar" : "bg-surface ring-line hover:ring-accent"
              }`}>
              {c.parent_id ? "↳ " : ""}{c.name}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-1">
          {parent && (
            <Link href={`/map/${parent.id}`} className="text-sm font-medium text-accent">← {parent.name}</Link>
          )}
          <h1 className="font-display text-2xl font-bold">{workflow.name}</h1>
          {workflow.summary && <p className="text-muted">{workflow.summary}</p>}
        </div>
        <FlowChart
          workflow={workflow}
          steps={steps}
          sops={sops ?? []}
          readableCharts={charts.map((c) => c.id)}
          viewer={{ roleId: profile?.role?.id ?? null, deptId: profile?.role?.department?.id ?? null }}
          roles={roles ?? []}
          isAdmin={isAdmin}
        />
      </main>
    </div>
  );
}
