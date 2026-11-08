"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;
const back = (person: string, q = "") => `/onboarding?${UUID.test(person) ? `person=${person}&` : ""}${q}`;

// Tick or untick one task. The database decides who may: new hires their own
// tasks, managers their team's, admins anyone's.
export async function toggleTask(formData: FormData) {
  const person = String(formData.get("person") ?? "");
  const task = Number(formData.get("task"));
  if (!UUID.test(person) || !task) redirect("/onboarding");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = formData.get("done") === "1"
    ? await supabase.from("onboarding_progress").delete().eq("person_id", person).eq("task_id", task)
    : await supabase.from("onboarding_progress").insert({ person_id: person, task_id: task, done_by: user?.id });
  if (error) redirect(back(person, `error=${encodeURIComponent("Couldn't update that task: " + error.message)}`));
  revalidatePath("/onboarding");
  redirect(back(person));
}

export async function saveStartDate(formData: FormData) {
  const person = String(formData.get("person") ?? "");
  const d = String(formData.get("start_date") ?? "") || null;
  if (!UUID.test(person)) redirect("/onboarding");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_start_date", { person, d });
  if (error) redirect(back(person, `error=${encodeURIComponent(error.message)}`));
  revalidatePath("/onboarding");
  redirect(back(person, "notice=Start+date+saved."));
}

// Admins edit the checklist itself.
export async function addTask(formData: FormData) {
  const person = String(formData.get("person") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || "General";
  const owner = String(formData.get("owner") ?? "employee");
  const due = Math.max(0, Math.min(365, Number(formData.get("due_days")) || 0));
  const sop = String(formData.get("sop_id") ?? "") || null;
  const [scope, scopeId] = String(formData.get("scope") ?? "").split(":");
  if (!title) redirect(back(person, "error=Type+the+task."));
  const supabase = await createClient();
  const { error } = await supabase.from("onboarding_tasks").insert({
    title, category, owner, due_days: due, sop_id: sop, sort: Date.now() % 1e9,
    department_id: scope === "dept" ? Number(scopeId) : null,
    role_id: scope === "role" ? Number(scopeId) : null,
  });
  if (error) redirect(back(person, `error=${encodeURIComponent("Couldn't add it: " + error.message)}`));
  revalidatePath("/onboarding");
  redirect(back(person, "notice=Task+added."));
}

export async function removeTask(formData: FormData) {
  const person = String(formData.get("person") ?? "");
  const supabase = await createClient();
  await supabase.from("onboarding_tasks").delete().eq("id", Number(formData.get("task")));
  revalidatePath("/onboarding");
  redirect(back(person, "notice=Task+removed."));
}
