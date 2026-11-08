import Link from "next/link";
import type { Profile } from "@/lib/profile";

export type DashTab = "sops" | "dept" | "handbook" | "people" | "policies" | "search";

const TABS: { id: DashTab; label: string; href: string }[] = [
  { id: "sops", label: "My SOPs", href: "/" },
  { id: "dept", label: "My Dept", href: "/dept" },
  { id: "handbook", label: "Employee handbook", href: "/handbook" },
  { id: "people", label: "People", href: "/people" },
  { id: "policies", label: "Policies", href: "/policies" },
  { id: "search", label: "Search", href: "/search" },
];

// Greeting, section tabs and a search box shared by every dashboard section.
export default function DashboardHeader({ profile, active, q = "" }: { profile: Profile | null; active: DashTab; q?: string }) {
  const name = profile?.full_name?.split(" ")[0] || profile?.email;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">My dashboard</p>
          <h1 className="font-display text-3xl font-bold">Hi, {name}</h1>
          {profile?.role && (
            <p className="text-muted">
              {profile.role.name}
              {profile.role.department && ` · ${profile.role.department.name}`}
            </p>
          )}
        </div>
        <form action="/search" role="search" className="flex w-full gap-2 sm:w-auto">
          <label htmlFor="dash-q" className="sr-only">Search SOPs, policies, the handbook and people</label>
          <input id="dash-q" name="q" type="search" defaultValue={q} placeholder="Search SOPs, policies, people…"
            className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm sm:w-72" />
          <button type="submit" className="h-10 rounded-lg bg-bar px-4 text-sm font-semibold text-white">Search</button>
        </form>
      </div>
      {!profile?.role && (
        <p className="rounded-lg bg-[#fff3d6] p-4 text-sm text-[#6b3f00]">
          You don&apos;t have a role yet. An admin needs to pick one for you before your SOPs show up.
        </p>
      )}
      <nav aria-label="Dashboard sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-line">
          {TABS.map((t) => (
            <li key={t.id}>
              <Link href={t.href} aria-current={t.id === active ? "page" : undefined}
                className={`-mb-px block border-b-2 px-3 py-2.5 text-sm font-semibold ${
                  t.id === active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"}`}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
