import { redirect } from "next/navigation";
import SignedInBar from "@/components/SignedInBar";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, PROFILE_FIELDS, type Profile } from "@/lib/profile";
import { AddPersonForm, SignInLinkButton } from "@/components/LinkForms";
import PersonRow from "@/components/PersonRow";
import { setPersonActive } from "./actions";

type Role = { id: number; name: string; department: { name: string } | null };
type Person = Profile & { job_title: string | null; reports_to: string | null };

const nameOf = (p: { full_name: string | null; email: string }) => p.full_name || p.email;

export default async function ManagePeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const me = await getMyProfile();
  if (!me?.role?.is_admin) redirect("/");

  const { error, notice } = await searchParams;
  const supabase = await createClient();
  const [{ data: people }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select(`${PROFILE_FIELDS}, job_title, reports_to`).order("full_name", { nullsFirst: true }).order("email").returns<Person[]>(),
    supabase.from("roles").select("id, name, department:departments(name)").order("name").returns<Role[]>(),
  ]);
  const everyone = people ?? [];
  const current = everyone.filter((p) => p.active);
  const removed = everyone.filter((p) => !p.active);
  const missingNames = current.filter((p) => !p.full_name).length;

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={me} />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Manage people</h1>
          <p className="text-muted">
            Names, job titles and who reports to whom show on the dashboard, People and the Org chart.
            {missingNames > 0 && ` ${missingNames} ${missingNames === 1 ? "person has" : "people have"} no name yet.`}
          </p>
        </div>

        {error && <p role="alert" className="rounded-lg bg-[#fbe4de] p-3 text-sm text-[#a3290f]">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-[#e1f4e8] p-3 text-sm text-[#12663a]">{notice}</p>}

        <section className="flex flex-col gap-3 rounded-xl bg-surface p-5 ring-1 ring-line">
          <h2 className="font-display text-lg font-bold">Add someone</h2>
          <p className="-mt-2 text-sm text-muted">Makes their account and gives you a sign-in link to send them yourself.</p>
          <AddPersonForm roles={roles ?? []} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">Everyone ({current.length})</h2>
          <ul className="flex flex-col gap-3">
            {current.map((p) => (
              <PersonRow key={p.id} p={p} roles={roles ?? []} isMe={p.id === me.id}
                others={current.filter((x) => x.id !== p.id)}>
                <SignInLinkButton email={p.email} />
              </PersonRow>
            ))}
          </ul>
        </section>

        {removed.length > 0 && (
          <details className="rounded-xl bg-surface p-4 ring-1 ring-line">
            <summary className="cursor-pointer font-display text-lg font-bold">Removed ({removed.length})</summary>
            <p className="mt-2 text-sm text-muted">They can&apos;t sign in and don&apos;t show on People or the Org chart. Their signed SOPs and certificates are kept.</p>
            <ul className="mt-3 flex flex-col divide-y divide-line">
              {removed.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><span className="font-semibold">{nameOf(p)}</span> <span className="text-sm text-muted">{p.email}</span></span>
                  <form action={setPersonActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value="true" />
                    <input type="hidden" name="name" value={nameOf(p)} />
                    <button type="submit" className="text-sm font-semibold text-accent underline">Restore</button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
    </div>
  );
}
