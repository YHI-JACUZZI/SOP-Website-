import { redirect } from "next/navigation";
import SignedInBar from "@/components/SignedInBar";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, PROFILE_FIELDS, type Profile } from "@/lib/profile";
import { invitePerson, setRole } from "./actions";

type Role = { id: number; name: string; department: { name: string } | null };

function RoleSelect({ roles, value }: { roles: Role[]; value?: number }) {
  return (
    <select
      name="role_id"
      defaultValue={value ?? ""}
      className="h-10 rounded-lg border border-line bg-surface px-2 text-sm"
    >
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

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const me = await getMyProfile();
  if (!me?.role?.is_admin) redirect("/");

  const { error, notice } = await searchParams;
  const supabase = await createClient();
  const [{ data: people }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select(PROFILE_FIELDS).order("email").returns<Profile[]>(),
    supabase.from("roles").select("id, name, department:departments(name)").order("name").returns<Role[]>(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={me} />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
        <h1 className="font-display text-3xl font-bold">People</h1>

        {error && (
          <p role="alert" className="rounded-lg bg-[#fbe4de] p-3 text-sm text-[#a3290f]">{error}</p>
        )}
        {notice && (
          <p role="status" className="rounded-lg bg-[#e1f4e8] p-3 text-sm text-[#12663a]">{notice}</p>
        )}

        <section className="flex flex-col gap-3 rounded-xl bg-surface p-5 ring-1 ring-line">
          <h2 className="font-display text-lg font-bold">Invite someone</h2>
          <form action={invitePerson} className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-60 flex-1 flex-col gap-1">
              <label htmlFor="invite-email" className="text-xs font-semibold uppercase tracking-wide text-muted">
                Work email
              </label>
              <input
                id="invite-email"
                name="email"
                type="email"
                required
                className="h-10 rounded-lg border border-line bg-surface px-3"
              />
            </div>
            <RoleSelect roles={roles ?? []} />
            <button type="submit" className="h-10 rounded-lg bg-[#c25508] px-4 font-semibold text-white">
              Send invite
            </button>
          </form>
        </section>

        <section className="overflow-x-auto rounded-xl bg-surface ring-1 ring-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-bar text-xs uppercase tracking-wide text-white">
              <tr>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {(people ?? []).map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{p.full_name || p.email}</div>
                    {p.full_name && <div className="text-muted">{p.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <form action={setRole} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <RoleSelect roles={roles ?? []} value={p.role?.id} />
                      <button type="submit" className="h-10 rounded-lg px-3 font-semibold text-accent ring-1 ring-accent">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
