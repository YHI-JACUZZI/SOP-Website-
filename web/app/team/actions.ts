"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function backTo(formData: FormData) {
  const dept = String(formData.get("dept") ?? "");
  const type = String(formData.get("type") ?? "");
  const sp = new URLSearchParams({ ...(dept ? { dept } : {}), ...(type === "policies" ? { type } : {}) }).toString();
  return (q?: string) => `/team${sp || q ? "?" : ""}${sp}${sp && q ? "&" : ""}${q ?? ""}`;
}

// The database decides who may assign what: admins anything, managers only
// their own department's people and roles.
// "Everyone in a department" and "Everyone in the company" save one
// assignment per role, so a role added later needs assigning on its own.
export async function assignSop(formData: FormData) {
  const back = backTo(formData);
  const sopId = String(formData.get("sop_id") ?? "");
  const [kind, target] = String(formData.get("target") ?? "").split(":");
  const due = String(formData.get("due_date") ?? "") || null;
  const months = Number(formData.get("refresh_months")) || null;
  if (!sopId || !target || !["role", "person", "dept", "company"].includes(kind)) redirect(back("error=Pick+what+to+assign+and+who+it%27s+for."));

  const supabase = await createClient();
  let targets: ({ role_id: number } | { person_id: string })[];
  if (kind === "dept" || kind === "company") {
    let query = supabase.from("roles").select("id");
    if (kind === "dept") query = query.eq("department_id", Number(target));
    const { data: roles } = await query.returns<{ id: number }[]>();
    targets = (roles ?? []).map((r) => ({ role_id: r.id }));
    if (!targets.length) redirect(back("error=There+are+no+roles+there+to+assign+to."));
  } else {
    targets = [kind === "role" ? { role_id: Number(target) } : { person_id: target }];
  }

  const { error } = await supabase.from("assignments").insert(
    targets.map((t) => ({ sop_id: sopId, due_date: due, refresh_months: months, ...t })),
  );
  if (error) redirect(back(`error=${encodeURIComponent("Couldn't assign it: " + error.message)}`));
  revalidatePath("/team");
  redirect(back(`notice=${encodeURIComponent(targets.length > 1 ? `Assigned to ${targets.length} roles.` : "Assigned.")}`));
}

export async function removeAssignment(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("assignments").delete().eq("id", Number(formData.get("id")));
  revalidatePath("/team");
  redirect(backTo(formData)());
}
