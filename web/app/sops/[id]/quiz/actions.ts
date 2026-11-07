"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SOP_ID_PATTERN } from "@/lib/sops";
import { createClient } from "@/lib/supabase/server";

const SLOTS = 6;

// Add or change one quiz question. The database only lets admins, and
// managers of the SOP's department, do this.
export async function saveQuestion(formData: FormData) {
  const sopId = String(formData.get("sop_id") ?? "");
  if (!SOP_ID_PATTERN.test(sopId)) redirect("/");
  const back = (q: string) => `/sops/${sopId}/quiz?${q}`;
  const id = Number(formData.get("qid")) || null;
  const question = String(formData.get("question") ?? "").trim();
  const slots = Array.from({ length: SLOTS }, (_, i) => String(formData.get(`c${i}`) ?? "").trim());
  const picked = Number(formData.get("answer"));
  const choices = slots.filter(Boolean);
  if (!question) redirect(back("error=Type+the+question."));
  if (choices.length < 2) redirect(back("error=Give+at+least+two+answers+to+choose+from."));
  if (!slots[picked]) redirect(back("error=Pick+which+answer+is+right."));
  const answer = slots.slice(0, picked).filter(Boolean).length;

  const supabase = await createClient();
  const row = { sop_id: sopId, question, choices, answer, ...(id ? {} : { sort: Date.now() % 1e9 }) };
  const { error } = id
    ? await supabase.from("quiz_questions").update(row).eq("id", id)
    : await supabase.from("quiz_questions").insert(row);
  if (error) redirect(back(`error=${encodeURIComponent("Couldn't save: " + error.message)}`));
  revalidatePath(`/sops/${sopId}/quiz`);
  redirect(back(`notice=${id ? "Saved." : "Question added."}`));
}

export async function deleteQuestion(formData: FormData) {
  const sopId = String(formData.get("sop_id") ?? "");
  if (!SOP_ID_PATTERN.test(sopId)) redirect("/");
  const supabase = await createClient();
  await supabase.from("quiz_questions").delete().eq("id", Number(formData.get("qid")));
  revalidatePath(`/sops/${sopId}/quiz`);
  redirect(`/sops/${sopId}/quiz?notice=Question+removed.`);
}
