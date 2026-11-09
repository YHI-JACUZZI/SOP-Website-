import type { Person } from "@/lib/directory";

export type OrgNode = { person: Person; children: OrgNode[] };

// Who each person reports to: the manager picked on Manage people, otherwise
// the manager of their department. Loops are broken so the chart always draws.
export function buildOrgChart(people: Person[]): { roots: OrgNode[]; unplaced: Person[] } {
  const byId = new Map(people.map((p) => [p.id, p]));
  const deptManager = new Map<number, string>();
  people.forEach((p) => {
    if (p.is_manager && p.department_id != null && !deptManager.has(p.department_id)) deptManager.set(p.department_id, p.id);
  });

  const parent = new Map<string, string | null>();
  people.forEach((p) => {
    let up: string | null = null;
    if (p.reports_to && byId.has(p.reports_to) && p.reports_to !== p.id) up = p.reports_to;
    else if (!p.is_manager && p.department_id != null) {
      const m = deptManager.get(p.department_id);
      if (m && m !== p.id) up = m;
    }
    parent.set(p.id, up);
  });

  // Break any loop (A reports to B, B reports to A) at the person who closes it.
  people.forEach((p) => {
    const seen = new Set<string>([p.id]);
    let cur = parent.get(p.id) ?? null;
    while (cur) {
      if (seen.has(cur)) {
        parent.set(p.id, null);
        break;
      }
      seen.add(cur);
      cur = parent.get(cur) ?? null;
    }
  });

  const nodes = new Map(people.map((p) => [p.id, { person: p, children: [] as OrgNode[] }]));
  const roots: OrgNode[] = [];
  people.forEach((p) => {
    const up = parent.get(p.id);
    if (up) nodes.get(up)!.children.push(nodes.get(p.id)!);
    else roots.push(nodes.get(p.id)!);
  });

  // Managers first, then by name, at every level.
  const sortTree = (list: OrgNode[]) => {
    list.sort((a, b) =>
      Number(b.person.is_manager) - Number(a.person.is_manager) ||
      (a.person.full_name || a.person.email).localeCompare(b.person.full_name || b.person.email));
    list.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);

  // People with nobody above or below them and no manager role aren't placed yet.
  const placed = roots.filter((n) => n.children.length > 0 || n.person.is_manager);
  const unplaced = roots.filter((n) => !placed.includes(n)).map((n) => n.person);
  return { roots: placed, unplaced };
}

export const countUnder = (n: OrgNode): number => n.children.reduce((sum, c) => sum + 1 + countUnder(c), 0);
