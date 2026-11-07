"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { escapeHtml, sendEmail } from "@/lib/email";
import { getMyProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { getSop, type Sop } from "@/lib/sops";
import { refresherStatement, signOffStatement } from "@/lib/signoff";

// Mark the SOP's current revision as finished by the signed-in person.
// The database only allows this for SOPs they can open.
export async function markComplete(formData: FormData) {
  const sop = await getSop(String(formData.get("id")));
  if (!sop) return;
  const supabase = await createClient();
  await supabase.from("completions").upsert(
    { sop_id: sop.id, revision: sop.revision },
    { onConflict: "sop_id,person_id,revision", ignoreDuplicates: true },
  );
  revalidatePath(`/sops/${sop.id}`);
  revalidatePath("/");
}

// Only unsigned completions can be undone; the database enforces it too.
export async function undoComplete(formData: FormData) {
  const sop = await getSop(String(formData.get("id")));
  if (!sop) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("completions").delete().eq("sop_id", sop.id).eq("revision", sop.revision).eq("person_id", user.id).is("signed_name", null);
  revalidatePath(`/sops/${sop.id}`);
  revalidatePath("/");
}

export type SignState = { error?: string };

const cleanName = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\s+/g, " ").trim();

// Signed sign-off on an assigned SOP: saves the typed signature and the
// statement it agreed to, emails the person's manager, then shows the certificate.
export async function signOff(_prev: SignState, formData: FormData): Promise<SignState> {
  const sop = await getSop(String(formData.get("id")));
  if (!sop) return { error: "This SOP isn't available to you." };
  const name = cleanName(formData.get("signed_name"));
  if (name.length < 2) return { error: "Type your full name to sign." };
  if (formData.get("agree") !== "on") return { error: "Tick the box to agree to the statement." };

  const supabase = await createClient();
  let { data, error } = await supabase
    .from("completions")
    .insert({ sop_id: sop.id, revision: sop.revision, signed_name: name, statement: signOffStatement(sop) })
    .select("certificate_id")
    .single<{ certificate_id: string }>();
  if (error?.code === "23505") {
    // Already signed (a double click): show the certificate that's there.
    const { data: { user } } = await supabase.auth.getUser();
    ({ data, error } = await supabase.from("completions").select("certificate_id")
      .eq("sop_id", sop.id).eq("revision", sop.revision).eq("person_id", user?.id ?? "")
      .single<{ certificate_id: string }>());
    if (data) redirect(`/certificates/${data.certificate_id}`);
  }
  if (error || !data) return { error: `Couldn't save your sign-off: ${error?.message ?? "unknown error"}` };

  await tellManagers(sop, data.certificate_id, name, "signed off");
  revalidatePath("/");
  redirect(`/certificates/${data.certificate_id}?new=1`);
}

export type RefresherState = {
  error?: string;
  result?: { score: number; total: number; passed: boolean; wrong: number[]; certificate_id: string };
};

// Marks the refresher quiz in the database (the answers never reach the browser).
export async function submitRefresher(_prev: RefresherState, formData: FormData): Promise<RefresherState> {
  const sop = await getSop(String(formData.get("id")));
  if (!sop) return { error: "This SOP isn't available to you." };
  const name = cleanName(formData.get("signed_name"));
  if (name.length < 2) return { error: "Type your full name to sign." };
  if (formData.get("agree") !== "on") return { error: "Tick the box to agree to the statement." };

  const picked: Record<string, number> = {};
  for (const [k, v] of formData.entries()) {
    const m = /^q_(\d+)$/.exec(k);
    if (m) picked[m[1]] = Number(v);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("submit_refresher", { sop: sop.id, picked, signed: name, agreed: refresherStatement(sop) })
    .single<{ score: number; total: number; passed: boolean; wrong: number[]; certificate_id: string }>();
  if (error || !data) return { error: `Couldn't save your refresher: ${error?.message ?? "unknown error"}` };

  if (data.passed) await tellManagers(sop, data.certificate_id, name, `passed the refresher (${data.score}%) for`);
  revalidatePath("/");
  revalidatePath(`/sops/${sop.id}`);
  return { result: data };
}

async function tellManagers(sop: Sop, certificateId: string, signedName: string, what: string) {
  const supabase = await createClient();
  const [{ data: managers }, me] = await Promise.all([
    supabase.rpc("my_manager_contacts"),
    getMyProfile(),
  ]);
  const to = ((managers as { email: string }[] | null) ?? []).map((m) => m.email);
  if (!to.length) return;
  const h = await headers();
  const origin = process.env.SITE_URL ?? `https://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const link = `${origin}/certificates/${certificateId}`;
  const who = me?.full_name || signedName;
  const subject = `${who} ${what} ${sop.id} ${sop.title}`;
  const line = `${who} ${what} ${sop.id} ${sop.title} (Revision ${sop.revision}), signed as "${signedName}".`;
  await sendEmail(
    to,
    subject,
    `<p>${escapeHtml(line)}</p><p><a href="${escapeHtml(link)}">View the certificate</a></p><p style="color:#5e5a56;font-size:13px">Sent by SOP Hub, Yancey Home Improvements.</p>`,
    `${line}\n\nView the certificate: ${link}\n\nSent by SOP Hub, Yancey Home Improvements.`,
  );
}
