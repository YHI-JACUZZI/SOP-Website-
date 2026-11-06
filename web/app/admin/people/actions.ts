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

export async function setRole(formData: FormData) {
  await requireAdmin();
  const roleId = Number(formData.get("role_id")) || null;
  const supabase = await createClient();
  // The database's own rules also block this for anyone who isn't an admin.
  await supabase
    .from("profiles")
    .update({ role_id: roleId })
    .eq("id", String(formData.get("id")));
  revalidatePath("/admin/people");
}

export async function invitePerson(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  if (!admin) {
    redirect("/admin/people?error=Invites need the Supabase secret key added to Vercel first.");
  }

  const email = String(formData.get("email")).trim().toLowerCase();
  const roleId = Number(formData.get("role_id")) || null;
  const origin = (await headers()).get("origin");

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/update-password`,
  });
  if (error) {
    redirect(`/admin/people?error=${encodeURIComponent(error.message)}`);
  }

  // The database creates their profile when the invite goes out; set the role on it.
  if (roleId && data.user) {
    await admin.from("profiles").update({ role_id: roleId }).eq("id", data.user.id);
  }
  revalidatePath("/admin/people");
  redirect(`/admin/people?notice=${encodeURIComponent(`Invite sent to ${email}.`)}`);
}
