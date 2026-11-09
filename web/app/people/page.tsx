import DashboardHeader from "@/components/DashboardHeader";
import PersonCard from "@/components/PersonCard";
import SignedInBar from "@/components/SignedInBar";
import { listPeople } from "@/lib/directory";
import { getMyProfile } from "@/lib/profile";

// Company directory, grouped by department.
export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [profile, people] = await Promise.all([getMyProfile(), listPeople()]);
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? people.filter((p) => [p.full_name, p.email, p.job_title, p.role, p.department].some((v) => v?.toLowerCase().includes(needle)))
    : people;
  const groups = new Map<string, typeof shown>();
  shown.forEach((p) => {
    const k = p.department ?? "Company-wide";
    groups.set(k, [...(groups.get(k) ?? []), p]);
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={profile} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <DashboardHeader profile={profile} active="people" />
        <form className="flex gap-2" role="search">
          <label htmlFor="people-q" className="sr-only">Filter people</label>
          <input id="people-q" name="q" type="search" defaultValue={q} placeholder="Filter by name, role or department"
            className="h-10 w-full max-w-sm rounded-lg border border-line bg-surface px-3 text-sm" />
          <button type="submit" className="h-10 rounded-lg bg-surface px-4 text-sm font-semibold ring-1 ring-line">Filter</button>
        </form>
        <p className="-mt-3 text-sm text-muted">{shown.length} {shown.length === 1 ? "person" : "people"}</p>
        {[...groups.entries()].map(([dept, list]) => (
          <section key={dept} className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-bold">{dept}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => <PersonCard key={p.id} p={p} />)}
            </ul>
          </section>
        ))}
        {shown.length === 0 && <p className="rounded-lg bg-surface p-4 text-sm text-muted ring-1 ring-line">No one matches “{q}”.</p>}
      </main>
    </div>
  );
}
