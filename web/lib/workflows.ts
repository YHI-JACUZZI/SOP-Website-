import { createClient } from "@/lib/supabase/server";

// A lane belongs to a role or a department; its steps take that owner.
export type Lane = { key: string; label: string; color: string; rows?: number; role_id?: number; department_id?: number };
export type Edge = { from: string; to: string; label?: string; route?: "lv" | "rv" | "down-over"; exit?: "bottom" };

export type WorkflowSummary = {
  id: string;
  name: string;
  parent_id: string | null;
  department: { name: string } | null;
};

export type Workflow = WorkflowSummary & {
  summary: string | null;
  department_id: number | null;
  parent_step: string | null;
  lanes: Lane[];
  edges: Edge[];
  routing: string | null;
};

export type Step = {
  key: string;
  label: string;
  type: "step" | "decision" | "terminal" | "placeholder";
  lane: string;
  col: number;
  row: number;
  sop_id: string | null;
  drill_id: string | null;
  owner_role_id: number | null;
  owner_department_id: number | null;
  note: string | null;
};

const SUMMARY_FIELDS = "id, name, parent_id, department:departments(name)";

// Only charts the database's permission rules let this person see.
export async function listMyWorkflows(): Promise<WorkflowSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workflows")
    .select(SUMMARY_FIELDS)
    .order("sort")
    .order("name")
    .returns<WorkflowSummary[]>();
  return data ?? [];
}

export async function getWorkflow(id: string): Promise<{ workflow: Workflow; steps: Step[] } | null> {
  if (!/^[a-z0-9-]{1,64}$/.test(id)) return null;
  const supabase = await createClient();
  const [{ data: workflow }, { data: steps }] = await Promise.all([
    supabase
      .from("workflows")
      .select(`${SUMMARY_FIELDS}, summary, department_id, parent_step, lanes, edges, routing`)
      .eq("id", id)
      .maybeSingle<Workflow>(),
    supabase
      .from("workflow_steps")
      .select("key, label, type, lane, col, row, sop_id, drill_id, owner_role_id, owner_department_id, note")
      .eq("workflow_id", id)
      .returns<Step[]>(),
  ]);
  if (!workflow) return null;
  return { workflow, steps: steps ?? [] };
}
