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

export type RowState = { saved?: number; error?: string };

// Name, job title, manager and role for one person. Answers the row itself
// so it can say "Saved" right next to the button.
export async function savePerson(_prev: RowState, formData: FormData): Promise<RowState> {
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
  if (error) return { error: `Couldn't save: ${error.message}` };
  revalidatePath("/", "layout");
  return { saved: Date.now() };
}

// Removing someone switches their account off: they can't sign in, they
// drop out of People and the Org chart, and their access ends. Their signed
// SOPs and certificates are kept, and Restore brings them back.
export async function setPersonActive(formData: FormData) {
  await requireAdmin();
  const me = await getMyProfile();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  if (id === me?.id) redirect(`/admin/people?error=${encodeURIComponent("You can't remove yourself.")}`);

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
  if (error) redirect(`/admin/people?error=${encodeURIComponent("Couldn't update: " + error.message)}`);
  if (!active) await supabase.from("profiles").update({ reports_to: null }).eq("reports_to", id);

  // Also block or unblock sign-in, when the secret key is set up.
  const admin = createAdminClient();
  if (admin) await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });

  revalidatePath("/", "layout");
  const who = String(formData.get("name") ?? "They");
  redirect(`/admin/people?notice=${encodeURIComponent(active ? `${who} is back.` : `${who} has been removed. You can restore them at the bottom of the page.`)}`);
}

export type LinkState = { link?: string; email?: string; error?: string; added?: boolean };

const NO_KEY = "Adding people needs the Supabase secret key in Vercel first (one-time setup).";

// Builds a sign-in link to this site's Continue page (/auth/accept).
async function siteLink(hashedToken: string, type: "invite" | "recovery") {
  const origin = (await headers()).get("origin") ?? "";
  return `${origin}/auth/accept?token_hash=${encodeURIComponent(hashedToken)}&type=${type}&next=/update-password`;
}

// Creates the account and hands back a link to send them yourself (text,
// Teams, email). No email goes out from the site.
export async function addPerson(_prev: LinkState, formData: FormData): Promise<LinkState> {
  await requireAdmin();
  const admin = createAdminClient();
  if (!admin) return { error: NO_KEY };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Type a valid email address." };
  const roleId = Number(formData.get("role_id")) || null;
  const fullName = text(formData.get("full_name"));
  const jobTitle = text(formData.get("job_title"));

  const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email });
  if (error || !data.properties) {
    const taken = /already|registered|exists/i.test(error?.message ?? "");
    return { error: taken ? `${email} already has an account. Use "Get sign-in link" on their row below.` : `Couldn't add them: ${error?.message}` };
  }

  // The database creates their profile with the account; fill it in.
  await admin.from("profiles").update({ role_id: roleId, full_name: fullName, job_title: jobTitle }).eq("id", data.user.id);
  revalidatePath("/admin/people");
  return { link: await siteLink(data.properties.hashed_token, "invite"), email, added: true };
}

// A fresh sign-in link for someone who already has an account (lost link,
// forgot password, never finished signing up).
export async function signInLink(_prev: LinkState, formData: FormData): Promise<LinkState> {
  await requireAdmin();
  const admin = createAdminClient();
  if (!admin) return { error: NO_KEY };
  const email = String(formData.get("email") ?? "");
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties) return { error: `Couldn't make a link: ${error?.message}` };
  return { link: await siteLink(data.properties.hashed_token, "recovery"), email };
}
