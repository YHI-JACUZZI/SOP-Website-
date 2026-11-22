"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyProfile } from "@/lib/profile";
import { escapeHtml, sendEmail } from "@/lib/email";

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

export type LinkState = {
  link?: string; email?: string; error?: string; added?: boolean;
  password?: string; emailed?: boolean; emailProblem?: string;
};

const NO_KEY = "Adding people needs the Supabase secret key in Vercel first (one-time setup).";

// Builds a sign-in link to this site's Continue page (/auth/accept).
async function siteLink(hashedToken: string, type: "invite" | "recovery") {
  const origin = (await headers()).get("origin") ?? "";
  return `${origin}/auth/accept?token_hash=${encodeURIComponent(hashedToken)}&type=${type}&next=/update-password`;
}

function inviteEmail(link: string, name: string | null) {
  const hi = name ? `Hi ${escapeHtml(name.split(" ")[0])},` : "Hi,";
  const html = `<div style="font-family: Arial, Helvetica, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #111111; padding: 16px 24px;"><span style="color: #ffffff; font-size: 18px; font-weight: bold;">Yancey SOP Hub</span></div>
  <div style="padding: 24px; border: 1px solid #e5e1dc; border-top: 0;">
    <h2 style="margin: 0 0 12px; font-size: 20px;">You're invited</h2>
    <p style="margin: 0 0 16px; line-height: 1.5;">${hi} you've been given an account on the Yancey SOP Hub, where you'll find your SOPs, onboarding checklist, the employee handbook and company policies.</p>
    <p style="margin: 0 0 24px; line-height: 1.5;">Click the button to choose your password and sign in.</p>
    <a href="${escapeHtml(link)}" style="display: inline-block; background: #c25508; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">Set my password</a>
    <p style="margin: 24px 0 0; font-size: 13px; color: #6b6560; line-height: 1.5;">This link works once and expires soon. If it has expired, ask your manager to send a new invite. Not expecting this? You can ignore this email.</p>
  </div>
</div>`;
  const text = `${hi.replace(/&amp;/g, "&")} you've been given an account on the Yancey SOP Hub. Choose your password and sign in here (works once, expires soon): ${link}`;
  return { html, text };
}

// Two buttons share this form:
//  - Add: makes the account with a temporary password for you to hand over.
//    No email is sent. They choose their own password at first sign-in.
//  - Invite: makes the account and emails them a link to set their password.
//    If email isn't set up yet, you get the link to send yourself instead.
export async function addPerson(_prev: LinkState, formData: FormData): Promise<LinkState> {
  await requireAdmin();
  const admin = createAdminClient();
  if (!admin) return { error: NO_KEY };

  const intent = formData.get("intent") === "invite" ? "invite" : "add";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Type a valid email address." };
  const roleId = Number(formData.get("role_id")) || null;
  const fullName = text(formData.get("full_name"));
  const jobTitle = text(formData.get("job_title"));
  const taken = (msg = "") => /already|registered|exists/i.test(msg)
    ? `${email} already has an account. Use "Reset password" on their row below.`
    : `Couldn't add them: ${msg}`;

  let userId: string;
  const result: LinkState = { email, added: true };

  if (intent === "add") {
    const password = makeTempPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { must_change_password: true },
    });
    if (error || !data.user) return { error: taken(error?.message) };
    userId = data.user.id;
    result.password = password;
  } else {
    const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email });
    if (error || !data.properties) return { error: taken(error?.message) };
    userId = data.user.id;
    result.link = await siteLink(data.properties.hashed_token, "invite");
    const { html, text: plain } = inviteEmail(result.link, fullName);
    const sent = await sendEmail([email], "You're invited to the Yancey SOP Hub", html, plain);
    result.emailed = sent.status === "sent";
    if (!result.emailed) result.emailProblem = sent.detail;
  }

  // The database creates their profile with the account; fill it in.
  await admin.from("profiles").update({ role_id: roleId, full_name: fullName, job_title: jobTitle }).eq("id", userId);
  revalidatePath("/admin/people");
  return result;
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

export type ResetState = { password?: string; email?: string; error?: string; mustChange?: boolean };

// Sets a new password for someone (typed by the admin, or made up by the site). Admins only: checked here on the
// server, not just by hiding the button. The person signs in with it once
// and is then made to choose their own password.
export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  await requireAdmin();
  const admin = createAdminClient();
  if (!admin) return { error: "Resetting passwords needs the Supabase secret key in Vercel first (one-time setup)." };

  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "");
  const typed = String(formData.get("password") ?? "").trim();
  if (typed && typed.length < 8) return { error: "Use at least 8 characters, or leave it blank and the site will make one." };
  const password = typed || makeTempPassword();
  // Ticked by default: they sign in with this once, then choose their own.
  const mustChange = formData.get("must_change") === "on";

  const { error } = await admin.auth.admin.updateUserById(id, {
    password,
    user_metadata: { must_change_password: mustChange || null },
  });
  if (error) return { error: `Couldn't change it: ${error.message}` };
  return { password, email, mustChange };
}

// Easy to read out or type: no 0/O or 1/l/I look-alikes.
function makeTempPassword() {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string, n: number) =>
    Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => set[x % set.length]).join("");
  return `${pick(letters, 4)}-${pick(digits, 4)}-${pick(letters, 4)}`;
}
