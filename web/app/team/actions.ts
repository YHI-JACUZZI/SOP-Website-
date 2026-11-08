"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The database decides who may assign what: admins anything, managers only
// their own department's people and roles.
export async function assignSop(formData: FormData) {
  const dept = String(formData.get("dept") ?? "");
  const back = (q: string) => `/team?${dept ? `dept=${encodeURIComponent(dept)}&` : ""}${q}`;
  const sopId = String(formData.get("sop_id") ?? "");
  const [kind, target] = String(formData.get("target") ?? "").split(":");
  const due = String(formData.get("due_date") ?? "") || null;
  const months = Number(formData.get("refresh_months")) || null;
  if (!sopId || !target || (kind !== "role" && kind !== "person")) redirect(back("error=Pick+an+SOP+and+who+it%27s+for."));

  const supabase = await createClient();
  const { error } = await supabase.from("assignments").insert({
    sop_id: sopId,
    due_date: due,
    refresh_months: months,
    ...(kind === "role" ? { role_id: Number(target) } : { person_id: target }),
  });
  if (error) redirect(back(`error=${encodeURIComponent("Couldn't assign it: " + error.message)}`));
  revalidatePath("/team");
  redirect(back("notice=Assigned."));
}

export async function removeAssignment(formData: FormData) {
  const dept = String(formData.get("dept") ?? "");
  const supabase = await createClient();
  await supabase.from("assignments").delete().eq("id", Number(formData.get("id")));
  revalidatePath("/team");
  redirect(`/team${dept ? `?dept=${encodeURIComponent(dept)}` : ""}`);
}
