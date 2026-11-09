"use client";

import { useActionState, useState } from "react";
import { addPerson, signInLink, type LinkState } from "@/app/admin/people/actions";

function CopyLink({ state }: { state: LinkState }) {
  const [copied, setCopied] = useState(false);
  if (!state.link) return null;
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-[#e1f4e8] p-3 text-sm text-[#12663a]">
      <p className="font-semibold">
        {state.added ? `Account made for ${state.email}. ` : ""}Send them this link (text, Teams or email). It works once, and only for a short time.
      </p>
      <div className="flex gap-2">
        <input readOnly value={state.link} aria-label="Sign-in link" onFocus={(e) => e.currentTarget.select()}
          className="h-9 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 font-mono text-xs text-foreground" />
        <button type="button" className="h-9 shrink-0 rounded-md bg-[#12663a] px-3 font-semibold text-white"
          onClick={() => navigator.clipboard.writeText(state.link!).then(() => setCopied(true))}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs">They click it, choose a password, and they&apos;re in.</p>
    </div>
  );
}

const field = "h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm";
const label = "text-xs font-semibold uppercase tracking-wide text-muted";

export function AddPersonForm({ roles }: { roles: { id: number; name: string; department: { name: string } | null }[] }) {
  const [state, action, pending] = useActionState(addPerson, {});
  return (
    <div className="flex flex-col gap-3">
      <form action={action} key={state.added ? state.link : "new"} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="add-name" className={label}>Full name</label>
          <input id="add-name" name="full_name" className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="add-email" className={label}>Email</label>
          <input id="add-email" name="email" type="email" required className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="add-title" className={label}>Job title</label>
          <input id="add-title" name="job_title" className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="add-role" className={label}>Role</label>
          <select id="add-role" name="role_id" defaultValue="" className={field}>
            <option value="">No role yet</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}{r.department ? ` (${r.department.name})` : ""}</option>)}
          </select>
        </div>
        <button type="submit" disabled={pending} className="h-10 rounded-lg bg-[#c25508] px-4 font-semibold text-white disabled:opacity-60">
          {pending ? "Adding…" : "Add and get link"}
        </button>
      </form>
      {state.error && <p role="alert" className="rounded-lg bg-[#fbe4de] p-3 text-sm text-[#a3290f]">{state.error}</p>}
      <CopyLink state={state} />
    </div>
  );
}

export function SignInLinkButton({ email }: { email: string }) {
  const [state, action, pending] = useActionState(signInLink, {});
  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <input type="hidden" name="email" value={email} />
        <button type="submit" disabled={pending} className="text-sm font-semibold text-accent underline disabled:opacity-60">
          {pending ? "Making link…" : "Get sign-in link"}
        </button>
      </form>
      {state.error && <p role="alert" className="text-sm text-[#a3290f]">{state.error}</p>}
      <CopyLink state={state} />
    </div>
  );
}
