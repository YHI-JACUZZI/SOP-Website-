import { displayName, initials, type Person } from "@/lib/directory";
import { buildOrgChart, countUnder, type OrgNode } from "@/lib/orgChart";

function Card({ p, me, compact = false }: { p: Person; me: boolean; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl bg-surface p-2.5 text-left ring-1 ${me ? "ring-2 ring-accent" : "ring-line"} ${compact ? "w-full" : "w-48"}`}>
      <span aria-hidden className={`flex size-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-white ${p.is_manager ? "bg-accent" : "bg-bar"}`}>
        {initials(p)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold">{displayName(p)}{me && <span className="font-normal text-muted"> (you)</span>}</span>
        <span className="truncate text-xs text-muted">{p.job_title || p.role || "No role yet"}</span>
        {p.department && <span className="truncate text-[11px] text-muted">{p.department}</span>}
      </span>
    </div>
  );
}

// Wide screens: a top-down tree. A manager whose team has no one under them
// shows the team as one stacked column, so the chart doesn't sprawl sideways.
function Tree({ node, myId }: { node: OrgNode; myId?: string }) {
  const kids = node.children;
  const stack = kids.length >= 3 && kids.every((k) => k.children.length === 0);
  return (
    <li>
      <div className="inline-flex"><Card p={node.person} me={node.person.id === myId} /></div>
      {kids.length > 0 && (
        <ul>
          {stack ? (
            <li>
              <div className="inline-flex w-48 flex-col gap-1.5 rounded-xl bg-background p-1.5 ring-1 ring-line">
                {kids.map((k) => <Card key={k.person.id} p={k.person} me={k.person.id === myId} compact />)}
              </div>
            </li>
          ) : (
            kids.map((k) => <Tree key={k.person.id} node={k} myId={myId} />)
          )}
        </ul>
      )}
    </li>
  );
}

// Phones: an indented list.
function List({ node, myId }: { node: OrgNode; myId?: string }) {
  return (
    <li className="flex flex-col gap-2">
      <Card p={node.person} me={node.person.id === myId} compact />
      {node.children.length > 0 && (
        <ul className="ml-4 flex flex-col gap-2 border-l-2 border-line pl-3">
          {node.children.map((k) => <List key={k.person.id} node={k} myId={myId} />)}
        </ul>
      )}
    </li>
  );
}

// The whole chart: tree on wide screens, list on phones, then anyone not placed.
export default function OrgChart({ people, myId }: { people: Person[]; myId?: string }) {
  const { roots, unplaced } = buildOrgChart(people);
  return (
    <>
      {roots.length === 0 && (
        <p className="rounded-lg bg-surface p-4 text-sm text-muted ring-1 ring-line">
          No reporting lines yet. Once people have roles (and managers are set), the chart fills in.
        </p>
      )}

      {roots.length > 0 && (
        <>
          <div className="hidden overflow-x-auto pb-4 md:block">
            <div className="org mx-auto w-max min-w-full">
              <ul>{roots.map((n) => <Tree key={n.person.id} node={n} myId={myId} />)}</ul>
            </div>
          </div>
          <ul className="flex flex-col gap-4 md:hidden">
            {roots.map((n) => <List key={n.person.id} node={n} myId={myId} />)}
          </ul>
          <p className="text-xs text-muted">
            {roots.length === 1 ? `${countUnder(roots[0]!) + 1} people in one chart.` : `${roots.length} separate teams. Pick a "Reports to" for each manager on Manage people to join them into one chart.`}
          </p>
        </>
      )}

      {unplaced.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">Not placed yet ({unplaced.length})</h2>
          <p className="-mt-2 text-sm text-muted">These people have no department manager and nobody picked as their manager.</p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {unplaced.map((p) => <li key={p.id}><Card p={p} me={p.id === myId} compact /></li>)}
          </ul>
        </section>
      )}
    </>
  );
}
