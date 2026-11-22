"use client";

import { useActionState, useState } from "react";
import { addPerson, resetPassword, signInLink, type LinkState, type ResetState } from "@/app/admin/people/actions";

function CopyLink({ state }: { state: LinkState }) {
  const [copied, setCopied] = useState(false);
  if (!state.link) return null;
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-ok-bg p-3 text-sm text-ok">
      <p className="font-semibold">
        {state.added ? `Account made for ${state.email}. ` : ""}Send them this link (text, Teams or email). It works once, and only for a short time.
      </p>
      <div className="flex gap-2">
        <input readOnly value={state.link} aria-label="Sign-in link" onFocus={(e) => e.currentTarget.select()}
          className="h-9 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 font-mono text-xs text-foreground" />
        <button type="button" className="h-9 shrink-0 rounded-md bg-ok px-3 font-semibold text-white"
          onClick={() => navigator.clipboard.writeText(state.link!).then(() => setCopied(true))}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs">They click it, choose a password, and they&apos;re in.</p>
    </div>
  );
}

function TempPassword({ password, email, mustChange, intro }: { password: string; email: string; mustChange: boolean; intro: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-ok-bg p-3 text-sm text-ok">
      <p className="font-semibold">{intro}</p>
      <div className="flex gap-2">
        <input readOnly value={password} aria-label="Password" onFocus={(e) => e.currentTarget.select()}
          className="h-9 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 font-mono text-sm text-foreground" />
        <button type="button" className="h-9 shrink-0 rounded-md bg-ok px-3 font-semibold text-white"
          onClick={() => navigator.clipboard.writeText(password).then(() => setCopied(true))}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs">
        They sign in with {email} and this password{mustChange ? ", then the site asks them to choose their own" : ""}.
        This is the only time it&apos;s shown.
      </p>
    </div>
  );
}

const field = "h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm";
const label = "text-xs font-semibold uppercase tracking-wide text-muted";

export function AddPersonForm({ roles }: { roles: { id: number; name: string; department: { name: string } | null }[] }) {
  const [state, action, pending] = useActionState(addPerson, {});
  return (
    <div className="flex flex-col gap-3">
      <form action={action} key={state.added ? (state.link ?? state.password) : "new"} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
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
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" name="intent" value="add" disabled={pending}
            title="Makes the account with a temporary password. No email is sent."
            className="h-10 flex-1 rounded-lg px-4 font-semibold text-accent ring-1 ring-accent disabled:opacity-60 lg:flex-none">
            Add
          </button>
          <button type="submit" name="intent" value="invite" disabled={pending}
            title="Makes the account and emails them a link to sign in."
            className="h-10 flex-1 rounded-lg bg-btn px-4 font-semibold text-white disabled:opacity-60 lg:flex-none">
            {pending ? "Working…" : "Invite"}
          </button>
        </div>
      </form>
      <p className="-mt-1 text-xs text-muted"><b>Add</b> makes the account and gives you a temporary password to hand them. <b>Invite</b> also emails them a link to sign in.</p>
      {state.error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}
      {state.added && state.password && <TempPassword password={state.password} email={state.email!} mustChange intro={`Account made for ${state.email}. Give them this temporary password:`} />}
      {state.added && state.emailed && (
        <p role="status" className="rounded-lg bg-ok-bg p-3 text-sm font-semibold text-ok">Invite sent to {state.email}. They click the link in the email, choose a password, and they&apos;re in.</p>
      )}
      {state.added && state.link && !state.emailed && (
        <>
          <p role="alert" className="rounded-lg bg-caution-bg p-3 text-sm text-caution">
            The account is made, but the invite email couldn&apos;t be sent ({state.emailProblem}). Send them the link below yourself for now.
          </p>
          <CopyLink state={state} />
        </>
      )}
    </div>
  );
}

export function SignInLinkButton({ email, label: text = "Get sign-in link" }: { email: string; label?: string }) {
  const [state, action, pending] = useActionState(signInLink, {});
  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <input type="hidden" name="email" value={email} />
        <button type="submit" disabled={pending} className="text-sm font-semibold text-accent underline disabled:opacity-60">
          {pending ? "Making link…" : text}
        </button>
      </form>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <CopyLink state={state} />
    </div>
  );
}

// Reset password on a Manage people row. Only rendered for admins, and the
// server action checks again. Opens a small panel first, so one stray click
// never changes anyone's password.
export function ResetPasswordButton({ id, email, name }: { id: string; email: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {});

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-accent ring-1 ring-accent hover:bg-chip">
        Reset password
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3 sm:max-w-xl">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display font-bold">Reset or change password for {name}</p>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted underline">Close</button>
      </div>

      {state.password ? (
        <TempPassword password={state.password} email={state.email!} mustChange={!!state.mustChange}
          intro="Done. Their old password no longer works. Their new password is:" />
      ) : (
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="email" value={email} />
          <label htmlFor={`tp-${id}`} className={label}>New password (optional)</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id={`tp-${id}`} name="password" type="text" autoComplete="off" minLength={8}
              placeholder="Type one, or leave blank and the site makes one" className={`${field} sm:flex-1`} />
            <button type="submit" disabled={pending} className="h-10 shrink-0 rounded-lg bg-btn px-4 font-semibold text-white disabled:opacity-60">
              {pending ? "Saving…" : "Set password"}
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="must_change" defaultChecked className="size-4 accent-[var(--accent)]" />
            Make them choose their own password next time they sign in
          </label>
          <p className="text-xs text-muted">Their current password stops working straight away.</p>
          {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        </form>
      )}

      <div className="border-t border-line pt-2 text-sm text-muted">
        <p className="mb-1">Or send them a link to choose a new password themselves:</p>
        <SignInLinkButton email={email} label="Get reset link" />
      </div>
    </div>
  );
}
