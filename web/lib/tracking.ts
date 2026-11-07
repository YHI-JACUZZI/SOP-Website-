// Status of one person's progress on one SOP, shared by My SOPs and the team dashboard.

export type Status = "done" | "refresh" | "reread" | "overdue" | "reading" | "todo";

export type Completion = { sop_id: string; person_id: string; revision: string; completed_at: string };
export type View = { sop_id: string; person_id: string; first_viewed_at: string; last_viewed_at: string };
export type Assignment = {
  id: number;
  sop_id: string;
  person_id: string | null;
  role_id: number | null;
  due_date: string | null;
  refresh_months?: number | null;
};
export type Refresher = {
  sop_id: string;
  person_id: string;
  revision: string;
  score: number;
  passed: boolean;
  completed_at: string;
};

export const STATUS_STYLE: Record<Status, { text: string; bg: string; fg: string }> = {
  done: { text: "Done", bg: "#E1F4E8", fg: "#12663A" },
  refresh: { text: "Refresher due", bg: "#E6EEFB", fg: "#1D4E9E" },
  reread: { text: "New revision", bg: "#FFF3D6", fg: "#6B3F00" },
  overdue: { text: "Overdue", bg: "#FBE4DE", fg: "#A3290F" },
  reading: { text: "In progress", bg: "#FFF3D6", fg: "#6B3F00" },
  todo: { text: "Not started", bg: "#F1EFED", fg: "#5E5A56" },
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const applies = (a: Assignment, sopId: string, personId: string, roleId: number | null) =>
  a.sop_id === sopId && (a.person_id === personId || (a.role_id !== null && a.role_id === roleId));

// The earliest due date of the assignments that apply to this person.
export function dueFor(sopId: string, personId: string, roleId: number | null, assignments: Assignment[]) {
  const dates = assignments
    .filter((a) => applies(a, sopId, personId, roleId))
    .map((a) => a.due_date)
    .filter((d): d is string => !!d)
    .sort();
  return dates[0] ?? null;
}

// How often this person must refresh this SOP (the shortest of their assignments), or null.
export function refreshMonthsFor(sopId: string, personId: string, roleId: number | null, assignments: Assignment[]) {
  const m = assignments
    .filter((a) => applies(a, sopId, personId, roleId) && a.refresh_months)
    .map((a) => a.refresh_months!);
  return m.length ? Math.min(...m) : null;
}

export function addMonths(iso: string, months: number) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function isAssigned(sopId: string, personId: string, roleId: number | null, assignments: Assignment[]) {
  return assignments.some((a) => applies(a, sopId, personId, roleId));
}

export function statusFor(args: {
  sopId: string;
  revision: string;
  personId: string;
  roleId: number | null;
  completions: Completion[];
  views: View[];
  assignments: Assignment[];
  refreshers?: Refresher[];
}): { status: Status; date: string | null; due: string | null; nextRefresh: string | null; score: number | null } {
  const { sopId, revision, personId, roleId, completions, views, assignments, refreshers = [] } = args;
  const mine = completions.filter((c) => c.sop_id === sopId && c.person_id === personId);
  const current = mine.find((c) => c.revision === revision);
  const due = dueFor(sopId, personId, roleId, assignments);
  const tries = refreshers
    .filter((r) => r.sop_id === sopId && r.person_id === personId)
    .sort((a, b) => a.completed_at.localeCompare(b.completed_at));
  const score = tries.at(-1)?.score ?? null;
  const none = { nextRefresh: null, score };
  if (current) {
    // A refresher comes due a set time after the last sign-off or passed refresher.
    const months = refreshMonthsFor(sopId, personId, roleId, assignments);
    if (!months) return { status: "done", date: current.completed_at, due, ...none };
    const passed = tries.filter((r) => r.passed && r.revision === revision).map((r) => r.completed_at);
    const last = [current.completed_at, ...passed].sort().at(-1)!;
    const next = addMonths(last, months);
    if (next <= todayIso()) return { status: "refresh", date: null, due: next, nextRefresh: next, score };
    return { status: "done", date: last, due, nextRefresh: next, score };
  }
  if (due && due < todayIso()) return { status: "overdue", date: null, due, ...none };
  if (mine.length) return { status: "reread", date: null, due, ...none };
  const seen = views.some((v) => v.sop_id === sopId && v.person_id === personId);
  return { status: seen ? "reading" : "todo", date: null, due, ...none };
}

export const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
