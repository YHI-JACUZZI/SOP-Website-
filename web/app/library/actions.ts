"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SOP_ID_PATTERN } from "@/lib/sops";
import { createClient } from "@/lib/supabase/server";

const KINDS = ["sop", "handbook", "policy"] as const;
const PAGE = { sop: "/", handbook: "/handbook", policy: "/policies" } as const;

// Admins file an imported document under SOPs, the Employee handbook or
// Policies, and choose whether everyone can open it. The database only lets
// admins change documents.
export async function fileDocument(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "") as (typeof KINDS)[number];
  const back = PAGE[String(formData.get("back") ?? "") as keyof typeof PAGE] ?? "/";
  if (!SOP_ID_PATTERN.test(id) || !KINDS.includes(kind)) redirect(`${back}?error=Pick+a+document.`);
  const supabase = await createClient();
  const { error } = await supabase
    .from("sops")
    .update({ kind, for_everyone: formData.get("for_everyone") === "on" })
    .eq("id", id);
  if (error) redirect(`${back}?error=${encodeURIComponent("Couldn't file it: " + error.message)}`);
  revalidatePath(back);
  revalidatePath(PAGE[kind]);
  redirect(`${back}?notice=Saved.`);
}
