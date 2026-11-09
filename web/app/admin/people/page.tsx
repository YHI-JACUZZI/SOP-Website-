import { redirect } from "next/navigation";
import SignedInBar from "@/components/SignedInBar";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, PROFILE_FIELDS, type Profile } from "@/lib/profile";
import { AddPersonForm, SignInLinkButton } from "@/components/LinkForms";
import { savePerson } from "./actions";

type Role = { id: number; name: string; department: { name: string } | null };
type Person = Profile & { job_title: string | null; reports_to: string | null };

const field = "h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm";
const label = "text-xs font-semibold uppercase tracking-wide text-muted";

function RoleSelect({ roles, value, id }: { roles: Role[]; value?: number; id: string }) {
  return (
    <select id={id} name="role_id" defaultValue={value ?? ""} className={field}>
      <option value="">No role yet</option>
      {roles.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
          {r.department ? ` (${r.department.name})` : ""}
        </option>
      ))}
    </select>
  );
}

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
  const missingNames = everyone.filter((p) => !p.full_name).length;

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
          <h2 className="font-display text-lg font-bold">Everyone ({everyone.length})</h2>
          <ul className="flex flex-col gap-3">
            {everyone.map((p) => (
              <li key={p.id} className={`rounded-xl bg-surface p-4 ring-1 ${p.full_name ? "ring-line" : "ring-2 ring-[#f1c46b]"}`}>
                <form action={savePerson} className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto] md:items-end">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`n-${p.id}`} className={label}>Name</label>
                    <input id={`n-${p.id}`} name="full_name" defaultValue={p.full_name ?? ""} placeholder="Add their name" className={field} />
                    <span className="truncate text-xs text-muted">{p.email}</span>
                  </div>
                  <div className="flex flex-col gap-1 md:pb-5">
                    <label htmlFor={`t-${p.id}`} className={label}>Job title</label>
                    <input id={`t-${p.id}`} name="job_title" defaultValue={p.job_title ?? ""} placeholder={p.role?.name ?? "e.g. Lead installer"} className={field} />
                  </div>
                  <div className="flex flex-col gap-1 md:pb-5">
                    <label htmlFor={`r-${p.id}`} className={label}>Reports to</label>
                    <select id={`r-${p.id}`} name="reports_to" defaultValue={p.reports_to ?? ""} className={field}>
                      <option value="">Their department manager</option>
                      {everyone.filter((x) => x.id !== p.id).map((x) => <option key={x.id} value={x.id}>{nameOf(x)}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 md:pb-5">
                    <label htmlFor={`ro-${p.id}`} className={label}>Role (what they can see)</label>
                    <RoleSelect id={`ro-${p.id}`} roles={roles ?? []} value={p.role?.id} />
                  </div>
                  <button type="submit" className="h-10 rounded-lg px-4 font-semibold text-accent ring-1 ring-accent md:mb-5">Save</button>
                </form>
                <div className="mt-2 border-t border-line pt-2">
                  <SignInLinkButton email={p.email} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
