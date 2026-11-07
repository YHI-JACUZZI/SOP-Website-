"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitRefresher, type RefresherState } from "@/app/sops/[id]/actions";
import { SignatureField, Statement } from "@/components/SignOffForm";

type Question = { id: number; question: string; choices: string[] };

// The refresher quiz plus a fresh signature. Marked in the database.
export default function RefresherForm({
  sopId, statement, suggested, questions, passMark,
}: {
  sopId: string;
  statement: string;
  suggested: string;
  questions: Question[];
  passMark: number;
}) {
  const [state, action, pending] = useActionState<RefresherState, FormData>(submitRefresher, {});
  const [name, setName] = useState(suggested);
  const [dismissed, setDismissed] = useState<RefresherState | null>(null);
  const r = state.result;

  if (r && state !== dismissed) {
    return (
      <div className="flex flex-col gap-3">
        <p className={`rounded-lg p-4 font-semibold ${r.passed ? "bg-[#e1f4e8] text-[#12663a]" : "bg-[#fbe4de] text-[#a3290f]"}`}>
          {r.total === 0
            ? "Refresher recorded."
            : r.passed
              ? `Passed with ${r.score}% (${r.total - r.wrong.length} of ${r.total} right).`
              : `${r.score}% this time. You need ${passMark}% to pass.`}
        </p>
        {!r.passed && r.wrong.length > 0 && (
          <p className="text-sm">
            Have another look at the SOP for question{r.wrong.length > 1 ? "s" : ""}{" "}
            {r.wrong.map((id) => questions.findIndex((q) => q.id === id) + 1).join(", ")}, then try again.
          </p>
        )}
        {r.passed ? (
          <Link href={`/certificates/${r.certificate_id}?new=1`} className="self-start font-semibold text-accent underline">
            View your certificate →
          </Link>
        ) : (
          <button type="button" onClick={() => setDismissed(state)} className="h-11 self-start rounded-lg bg-[#c25508] px-6 font-semibold text-white">
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={sopId} />
      {questions.length > 0 && (
        <ol className="flex flex-col gap-4">
          {questions.map((q, i) => (
            <li key={q.id}>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 font-semibold">{i + 1}. {q.question}</legend>
                {q.choices.map((c, j) => (
                  <label key={j} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2 ring-1 ring-line has-[:checked]:ring-2 has-[:checked]:ring-accent">
                    <input type="radio" name={`q_${q.id}`} value={j} required className="size-4 accent-[#c25508]" />
                    {c}
                  </label>
                ))}
              </fieldset>
            </li>
          ))}
        </ol>
      )}
      <Statement text={statement} />
      <SignatureField name={name} setName={setName} />
      {state.error && <p role="alert" className="rounded-lg bg-[#fbe4de] p-3 text-sm text-[#a3290f]">{state.error}</p>}
      <button type="submit" disabled={pending} className="h-11 self-start rounded-lg bg-[#c25508] px-6 font-semibold text-white disabled:opacity-60">
        {pending ? "Checking…" : questions.length ? "Submit answers and sign" : "Sign refresher"}
      </button>
    </form>
  );
}
