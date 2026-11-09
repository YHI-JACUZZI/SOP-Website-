"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyProfile } from "@/lib/profile";

async function requireAdmin() {
  const me = await getMyProfile();
  if (!me?.role?.is_admin) redirect("/");
}

const text = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\s+/g, " ").trim() || null;

// Name, job title, manager and role for one person.
export async function savePerson(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const reportsTo = String(formData.get("reports_to") ?? "") || null;
  const supabase = await createClient();
  // The database's own rules also block this for anyone who isn't an admin.
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: text(formData.get("full_name")),
      job_title: text(formData.get("job_title")),
      reports_to: reportsTo === id ? null : reportsTo,
      role_id: Number(formData.get("role_id")) || null,
    })
    .eq("id", id);
  if (error) redirect(`/admin/people?error=${encodeURIComponent("Couldn't save: " + error.message)}`);
  revalidatePath("/admin/people");
  redirect(`/admin/people?notice=Saved.`);
}

export async function invitePerson(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  if (!admin) {
    redirect("/admin/people?error=Invites need the Supabase secret key added to Vercel first.");
  }

  const email = String(formData.get("email")).trim().toLowerCase();
  const roleId = Number(formData.get("role_id")) || null;
  const fullName = text(formData.get("full_name"));
  const origin = (await headers()).get("origin");

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/update-password`,
  });
  if (error) {
    redirect(`/admin/people?error=${encodeURIComponent(error.message)}`);
  }

  // The database creates their profile when the invite goes out; set the role on it.
  if (data.user && (roleId || fullName)) {
    await admin.from("profiles").update({ role_id: roleId, full_name: fullName }).eq("id", data.user.id);
  }
  revalidatePath("/admin/people");
  redirect(`/admin/people?notice=${encodeURIComponent(`Invite sent to ${email}.`)}`);
}
