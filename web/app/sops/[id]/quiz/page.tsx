import Link from "next/link";
import { notFound } from "next/navigation";
import SignedInBar from "@/components/SignedInBar";
import { getMyProfile } from "@/lib/profile";
import { PASS_MARK } from "@/lib/signoff";
import { getSop } from "@/lib/sops";
import { createClient } from "@/lib/supabase/server";
import { deleteQuestion, saveQuestion } from "./actions";

type Q = { id: number; question: string; choices: string[]; answer: number };

const input = "h-10 rounded-lg border border-line bg-surface px-3 text-sm";

// Admins and the SOP's department manager write the refresher quiz here.
export default async function QuizPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { id } = await params;
  const { error, notice } = await searchParams;
  const [profile, sop] = await Promise.all([getMyProfile(), getSop(id)]);
  if (!sop) notFound();
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("can_edit_quiz", { sop: sop.id }).returns<boolean>();
  if (!allowed) notFound();
  const { data } = await supabase.from("quiz_questions").select("id, question, choices, answer")
    .eq("sop_id", sop.id).order("sort").order("id").returns<Q[]>();
  const questions = data ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={profile} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8 sm:px-6">
        <div>
          <Link href={`/sops/${sop.id}`} className="text-sm font-medium text-accent">← {sop.title}</Link>
          <h1 className="mt-1 font-display text-3xl font-bold">Refresher quiz</h1>
          <p className="text-muted">
            {sop.id} · Rev {sop.revision}. People answer these when a refresher comes due and need {PASS_MARK}% to pass.
            They never see the right answers, only which questions they missed. Three to five short questions works well.
          </p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-[#fbe4de] p-3 text-sm text-[#a3290f]">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-[#e1f4e8] p-3 text-sm text-[#12663a]">{notice}</p>}

        {questions.length === 0 && (
          <p className="rounded-lg bg-surface p-4 text-sm text-muted ring-1 ring-line">
            No questions yet. Without any, a refresher is just a re-read and a new signature.
          </p>
        )}
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-xl bg-surface p-5 ring-1 ring-line">
            <QuestionForm sopId={sop.id} q={q} heading={`Question ${i + 1}`} />
            <form action={deleteQuestion} className="mt-2">
              <input type="hidden" name="sop_id" value={sop.id} />
              <input type="hidden" name="qid" value={q.id} />
              <button type="submit" className="text-sm text-[#a3290f] underline">Remove question</button>
            </form>
          </div>
        ))}

        <div className="rounded-xl bg-surface p-5 ring-2 ring-accent/40">
          <QuestionForm sopId={sop.id} heading="Add a question" />
        </div>
      </main>
    </div>
  );
}

function QuestionForm({ sopId, q, heading }: { sopId: string; q?: Q; heading: string }) {
  const slots = Array.from({ length: Math.max(4, (q?.choices.length ?? 0) + 1) }).slice(0, 6);
  const key = q?.id ?? "new";
  return (
    <form action={saveQuestion} className="flex flex-col gap-3">
      <input type="hidden" name="sop_id" value={sopId} />
      {q && <input type="hidden" name="qid" value={q.id} />}
      <h2 className="font-display text-lg font-bold">{heading}</h2>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Question</span>
        <input name="question" required defaultValue={q?.question} className={input} />
      </label>
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-semibold">Answers (pick the right one)</legend>
        {slots.map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="answer" value={i} required defaultChecked={q ? q.answer === i : false}
              aria-label={`Answer ${i + 1} is right`} id={`a-${key}-${i}`} className="size-4 accent-[#c25508]" />
            <input name={`c${i}`} defaultValue={q?.choices[i] ?? ""} placeholder={i < 2 ? `Answer ${i + 1}` : `Answer ${i + 1} (optional)`}
              aria-label={`Answer ${i + 1}`} className={`${input} flex-1`} />
          </div>
        ))}
      </fieldset>
      <button type="submit" className="h-10 self-start rounded-lg bg-[#c25508] px-5 text-sm font-semibold text-white">
        {q ? "Save" : "Add question"}
      </button>
    </form>
  );
}
