// Status of one person's progress on one SOP, shared by My SOPs and the team dashboard.

export type Status = "done" | "reread" | "overdue" | "reading" | "todo";

export type Completion = { sop_id: string; person_id: string; revision: string; completed_at: string };
export type View = { sop_id: string; person_id: string; first_viewed_at: string; last_viewed_at: string };
export type Assignment = {
  id: number;
  sop_id: string;
  person_id: string | null;
  role_id: number | null;
  due_date: string | null;
};

export const STATUS_STYLE: Record<Status, { text: string; bg: string; fg: string }> = {
  done: { text: "Done", bg: "#E1F4E8", fg: "#12663A" },
  reread: { text: "New revision", bg: "#FFF3D6", fg: "#6B3F00" },
  overdue: { text: "Overdue", bg: "#FBE4DE", fg: "#A3290F" },
  reading: { text: "In progress", bg: "#FFF3D6", fg: "#6B3F00" },
  todo: { text: "Not started", bg: "#F1EFED", fg: "#5E5A56" },
};

const todayIso = () => new Date().toISOString().slice(0, 10);

// The earliest due date of the assignments that apply to this person.
export function dueFor(sopId: string, personId: string, roleId: number | null, assignments: Assignment[]) {
  const dates = assignments
    .filter((a) => a.sop_id === sopId && (a.person_id === personId || (a.role_id !== null && a.role_id === roleId)))
    .map((a) => a.due_date)
    .filter((d): d is string => !!d)
    .sort();
  return dates[0] ?? null;
}

export function isAssigned(sopId: string, personId: string, roleId: number | null, assignments: Assignment[]) {
  return assignments.some((a) => a.sop_id === sopId && (a.person_id === personId || (a.role_id !== null && a.role_id === roleId)));
}

export function statusFor(args: {
  sopId: string;
  revision: string;
  personId: string;
  roleId: number | null;
  completions: Completion[];
  views: View[];
  assignments: Assignment[];
}): { status: Status; date: string | null; due: string | null } {
  const { sopId, revision, personId, roleId, completions, views, assignments } = args;
  const mine = completions.filter((c) => c.sop_id === sopId && c.person_id === personId);
  const current = mine.find((c) => c.revision === revision);
  const due = dueFor(sopId, personId, roleId, assignments);
  if (current) return { status: "done", date: current.completed_at, due };
  if (due && due < todayIso()) return { status: "overdue", date: null, due };
  if (mine.length) return { status: "reread", date: null, due };
  const seen = views.some((v) => v.sop_id === sopId && v.person_id === personId);
  return { status: seen ? "reading" : "todo", date: null, due };
}

export const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
