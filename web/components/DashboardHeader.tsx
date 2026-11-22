import { setMyName } from "@/app/profile/actions";
import type { Profile } from "@/lib/profile";

export type DashTab = "sops" | "mysops" | "onboarding" | "dept" | "handbook" | "people" | "org" | "policies" | "search";

const TABS: { id: DashTab; label: string; href: string }[] = [
  { id: "sops", label: "My dashboard", href: "/" },
  { id: "mysops", label: "My SOPs", href: "/sops" },
  { id: "onboarding", label: "Onboarding", href: "/onboarding" },
  { id: "dept", label: "My department", href: "/dept" },
  { id: "handbook", label: "Employee handbook", href: "/handbook" },
  { id: "people", label: "People", href: "/people" },
  { id: "org", label: "Org chart", href: "/org" },
  { id: "policies", label: "Policies", href: "/policies" },
  { id: "search", label: "Search", href: "/search" },
];

// Page heading for the dashboard and its sections (the side menu does the
// navigating). The dashboard itself greets you with a one-line summary.
export default function DashboardHeader({ profile, active, q = "", summary }: { profile: Profile | null; active: DashTab; q?: string; summary?: string }) {
  const name = profile?.full_name?.split(" ")[0] || profile?.email;
  const hour = new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Los_Angeles" });
  const greeting = +hour < 12 ? "Good morning" : +hour < 17 ? "Good afternoon" : "Good evening";
  const tab = TABS.find((t) => t.id === active);
  return (
    <div className="flex flex-col gap-4">
      {active === "sops" ? (
        <div className="flex flex-col gap-1">
          <p className="text-muted">{greeting}, {name}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-[34px]">Your training today</h1>
          {summary && <p className="text-muted">{summary}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{tab?.label}</h1>
          {profile?.role && (
            <p className="text-muted">
              {profile.role.name}
              {profile.role.department && ` · ${profile.role.department.name}`}
            </p>
          )}
        </div>
      )}
      {active === "search" && (
        <form action="/search" role="search" className="flex w-full max-w-xl gap-2">
          <label htmlFor="dash-q" className="sr-only">Search SOPs, policies, the handbook and people</label>
          <input id="dash-q" name="q" type="search" defaultValue={q} placeholder="Search SOPs, policies, people…" autoFocus
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-[15px] outline-none focus:border-accent" />
          <button type="submit" className="h-11 rounded-xl bg-btn px-5 text-sm font-semibold text-white hover:bg-btn-hover">Search</button>
        </form>
      )}
      {profile && !profile.full_name && (
        <form action={setMyName} className="flex flex-col gap-2 rounded-lg bg-caution-bg p-4 text-sm text-caution sm:flex-row sm:items-end">
          <input type="hidden" name="back" value={TABS.find((t) => t.id === active)?.href ?? "/"} />
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="my-name" className="font-semibold">What&apos;s your name? It shows to your team instead of your email.</label>
            <input id="my-name" name="full_name" required minLength={2} maxLength={120} autoComplete="name" placeholder="First and last name"
              className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-foreground sm:max-w-sm" />
          </div>
          <button type="submit" className="h-10 rounded-lg bg-btn px-4 font-semibold text-white">Save name</button>
        </form>
      )}
      {!profile?.role && (
        <p className="rounded-lg bg-caution-bg p-4 text-sm text-caution">
          You don&apos;t have a role yet. An admin needs to pick one for you before your SOPs and policies show up.
        </p>
      )}
    </div>
  );
}
