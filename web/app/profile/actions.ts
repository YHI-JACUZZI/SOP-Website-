"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Anyone can set their own name; the database checks it's really them.
export async function setMyName(formData: FormData) {
  const name = String(formData.get("full_name") ?? "").replace(/\s+/g, " ").trim();
  const back = String(formData.get("back") ?? "/");
  const to = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  if (name.length < 2) redirect(to);
  const supabase = await createClient();
  await supabase.rpc("set_my_name", { new_name: name });
  revalidatePath("/", "layout");
  redirect(to);
}
