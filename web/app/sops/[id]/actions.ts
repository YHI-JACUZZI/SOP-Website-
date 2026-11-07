"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSop } from "@/lib/sops";

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

export async function undoComplete(formData: FormData) {
  const sop = await getSop(String(formData.get("id")));
  if (!sop) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("completions").delete().eq("sop_id", sop.id).eq("revision", sop.revision).eq("person_id", user.id);
  revalidatePath(`/sops/${sop.id}`);
  revalidatePath("/");
}
