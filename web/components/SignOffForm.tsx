"use client";

import { useActionState, useState } from "react";
import { signOff, type SignState } from "@/app/sops/[id]/actions";

// Typed, adopted-style signature under an assigned SOP.
export default function SignOffForm({ sopId, statement, suggested }: { sopId: string; statement: string; suggested: string }) {
  const [state, action, pending] = useActionState<SignState, FormData>(signOff, {});
  const [name, setName] = useState(suggested);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={sopId} />
      <Statement text={statement} />
      <SignatureField name={name} setName={setName} />
      {state.error && <p role="alert" className="rounded-lg bg-[#fbe4de] p-3 text-sm text-[#a3290f]">{state.error}</p>}
      <button type="submit" disabled={pending} className="h-11 self-start rounded-lg bg-[#c25508] px-6 font-semibold text-white disabled:opacity-60">
        {pending ? "Signing…" : "Sign and finish"}
      </button>
    </form>
  );
}

export function Statement({ text }: { text: string }) {
  return (
    <label className="flex items-start gap-3 rounded-lg bg-background p-4 text-sm leading-relaxed ring-1 ring-line">
      <input type="checkbox" name="agree" required className="mt-1 size-4 shrink-0 accent-[#c25508]" />
      <span>{text}</span>
    </label>
  );
}

export function SignatureField({ name, setName }: { name: string; setName: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="signed_name" className="text-sm font-semibold">Type your full name to sign</label>
      <input
        id="signed_name"
        name="signed_name"
        required
        minLength={2}
        maxLength={120}
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-11 max-w-sm rounded-lg border border-line bg-surface px-3"
      />
      <div aria-hidden className="flex min-h-20 max-w-sm items-end border-b-2 border-foreground/60 px-2 pb-1">
        <span className="font-signature text-5xl leading-none">{name}</span>
      </div>
      <span className="text-xs text-muted">Your adopted signature</span>
    </div>
  );
}
