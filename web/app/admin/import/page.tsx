import { redirect } from "next/navigation";
import SignedInBar from "@/components/SignedInBar";
import ImportForm from "@/components/ImportForm";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/profile";

export default async function ImportPage() {
  const me = await getMyProfile();
  if (!me?.role?.is_admin) redirect("/");

  const supabase = await createClient();
  const [{ data: sops }, { data: roles }, { data: departments }, { data: sopRoles }] =
    await Promise.all([
      supabase.from("sops").select("id, title, revision, department_id, status").order("id"),
      supabase.from("roles").select("id, name, department_id").order("name"),
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("sop_roles").select("sop_id, role_id"),
    ]);

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={me} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-bold">Import an SOP</h1>
          <p className="text-muted">
            Upload a Scribe Word export. It&apos;s put into the Yancey SOP
            template so you can check it before publishing.
          </p>
        </div>
        <ImportForm
          sops={sops ?? []}
          roles={roles ?? []}
          departments={departments ?? []}
          sopRoles={sopRoles ?? []}
          me={me.full_name || me.email}
        />
      </main>
    </div>
  );
}
