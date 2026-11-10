"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { Lane } from "@/lib/workflows";

// Lane colours the chart knows, used in turn for new charts.
const COLORS = ["pc", "fm", "wh", "inst", "sales", "sm", "pm", "admin", "prod", "roof"];

async function requireAdmin() {
  const me = await getMyProfile();
  if (!me?.role?.is_admin) redirect("/map");
}

const text = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\s+/g, " ").trim();
const fail = (back: string, msg: string): never => redirect(`/map/${back}?error=${encodeURIComponent(msg)}`);

// "Install Process (v2)" -> "install-process-v2", made unique.
async function freeId(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "chart";
  const { data } = await supabase.from("workflows").select("id").like("id", `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.id as string));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

async function nextSort(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("workflows").select("sort").order("sort", { ascending: false }).limit(1);
  return ((data?.[0]?.sort as number | undefined) ?? 0) + 1;
}

// A new chart. Lanes start as the roles in the chosen department (or one lane
// per department for a company-wide chart), with Start → First step → End.
export async function createChart(formData: FormData) {
  await requireAdmin();
  const back = text(formData.get("back")) || "company";
  const name = text(formData.get("name"));
  if (name.length < 2) fail(back, "Give the new chart a name.");
  const deptId = Number(formData.get("department_id")) || null;
  const parentId = text(formData.get("parent_id")) || null;
  const supabase = await createClient();

  let lanes: Lane[];
  if (deptId) {
    const { data: roles } = await supabase.from("roles").select("id, name").eq("department_id", deptId).order("is_manager", { ascending: false }).order("name");
    lanes = (roles ?? []).map((r, i) => ({ key: `l${i + 1}`, label: r.name as string, color: COLORS[i % COLORS.length]!, role_id: r.id as number }));
  } else {
    const { data: depts } = await supabase.from("departments").select("id, name").order("name");
    lanes = (depts ?? []).map((d, i) => ({ key: `l${i + 1}`, label: d.name as string, color: COLORS[i % COLORS.length]!, department_id: d.id as number }));
  }
  if (lanes.length === 0) lanes = [{ key: "l1", label: "Lane 1", color: COLORS[0]! }];

  const id = await freeId(supabase, name);
  const { error } = await supabase.from("workflows").insert({
    id, name, summary: text(formData.get("summary")) || null, department_id: deptId,
    parent_id: parentId, sort: await nextSort(supabase), lanes,
    edges: [{ from: "start", to: "s1" }, { from: "s1", to: "end" }],
  });
  if (error) fail(back, `Couldn't make the chart: ${error.message}`);

  const first = lanes[0]!;
  const owner = { owner_role_id: first.role_id ?? null, owner_department_id: first.department_id ?? null };
  await supabase.from("workflow_steps").insert([
    { workflow_id: id, key: "start", label: "Start", type: "terminal", lane: first.key, col: 0, row: 0, ...owner },
    { workflow_id: id, key: "s1", label: "First step", type: "step", lane: first.key, col: 1, row: 0, ...owner },
    { workflow_id: id, key: "end", label: "End", type: "terminal", lane: first.key, col: 2, row: 0, ...owner },
  ]);
  revalidatePath("/map", "layout");
  redirect(`/map/${id}?notice=${encodeURIComponent("New chart made. Click Edit chart to build it.")}`);
}

// A copy of a chart under a new name, with all its lanes, steps and arrows.
export async function duplicateChart(formData: FormData) {
  await requireAdmin();
  const from = text(formData.get("from"));
  const name = text(formData.get("name"));
  if (name.length < 2) fail(from, "Give the copy a name.");
  const supabase = await createClient();
  const [{ data: src }, { data: steps }] = await Promise.all([
    supabase.from("workflows").select("summary, department_id, parent_id, lanes, edges, routing").eq("id", from).maybeSingle(),
    supabase.from("workflow_steps").select("key, label, type, lane, col, row, sop_id, drill_id, owner_role_id, owner_department_id, note").eq("workflow_id", from),
  ]);
  if (!src) fail(from, "Couldn't find that chart to copy.");

  const id = await freeId(supabase, name);
  const { error } = await supabase.from("workflows").insert({
    ...src, id, name, summary: text(formData.get("summary")) || src!.summary, sort: await nextSort(supabase),
  });
  if (error) fail(from, `Couldn't copy the chart: ${error.message}`);
  if (steps?.length) {
    const { error: e2 } = await supabase.from("workflow_steps").insert(steps.map((s) => ({ ...s, workflow_id: id })));
    if (e2) {
      await supabase.from("workflows").delete().eq("id", id);
      fail(from, `Couldn't copy the steps: ${e2.message}`);
    }
  }
  revalidatePath("/map", "layout");
  redirect(`/map/${id}?notice=${encodeURIComponent(`Copied. You're now on "${name}". Click Edit chart to change it.`)}`);
}

// Name, description, who sees it, and which chart it sits under.
export async function saveChartDetails(formData: FormData) {
  await requireAdmin();
  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  if (name.length < 2) fail(id, "The chart needs a name.");
  const parentId = text(formData.get("parent_id")) || null;
  if (parentId === id) fail(id, "A chart can't sit under itself.");
  const supabase = await createClient();
  const { error } = await supabase.from("workflows").update({
    name, summary: text(formData.get("summary")) || null,
    department_id: Number(formData.get("department_id")) || null, parent_id: parentId, updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) fail(id, `Couldn't save: ${error.message}`);
  revalidatePath("/map", "layout");
  redirect(`/map/${id}?notice=Saved.`);
}

// Only when nothing else points at it. The company map can't be deleted.
export async function deleteChart(formData: FormData) {
  await requireAdmin();
  const id = text(formData.get("id"));
  if (id === "company") fail(id, "The company map can't be deleted.");
  const supabase = await createClient();
  const [{ data: kids }, { data: links }] = await Promise.all([
    supabase.from("workflows").select("name").eq("parent_id", id),
    supabase.from("workflow_steps").select("workflow_id, label").eq("drill_id", id).neq("workflow_id", id),
  ]);
  if (kids?.length) fail(id, `Move or delete the charts under this one first: ${kids.map((k) => k.name).join(", ")}.`);
  if (links?.length) fail(id, `Steps on other charts open this one (${links.map((l) => l.label).join(", ")}). Unlink them first.`);
  await supabase.from("workflow_steps").update({ drill_id: null }).eq("workflow_id", id).eq("drill_id", id);
  const { error } = await supabase.from("workflows").delete().eq("id", id);
  if (error) fail(id, `Couldn't delete: ${error.message}`);
  revalidatePath("/map", "layout");
  redirect(`/map/company?notice=${encodeURIComponent("Chart deleted.")}`);
}
