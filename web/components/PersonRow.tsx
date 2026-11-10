"use client";

import { useActionState, useEffect, useState } from "react";
import PendingButton from "@/components/PendingButton";
import { savePerson, setPersonActive, type RowState } from "@/app/admin/people/actions";

type Role = { id: number; name: string; department: { name: string } | null };
type Person = { id: string; email: string; full_name: string | null; job_title: string | null; reports_to: string | null; role: { id: number; name: string } | null };

const field = "h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm";
const label = "text-xs font-semibold uppercase tracking-wide text-muted";
const nameOf = (p: { full_name: string | null; email: string }) => p.full_name || p.email;

// One person on Manage people: edit and save in place, or remove them.
export default function PersonRow({ p, others, roles, isMe, children }: {
  p: Person;
  others: { id: string; full_name: string | null; email: string }[];
  roles: Role[];
  isMe: boolean;
  children?: React.ReactNode;
}) {
  const [state, action] = useActionState<RowState, FormData>(savePerson, {});
  const [showSaved, setShowSaved] = useState(false);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (!state.saved) return;
    setShowSaved(true);
    setChanged(false);
    const t = setTimeout(() => setShowSaved(false), 4000);
    return () => clearTimeout(t);
  }, [state.saved]);

  return (
    <li className={`rounded-xl bg-surface p-4 ${changed ? "ring-2 ring-accent" : p.full_name ? "ring-1 ring-line" : "ring-2 ring-[#f1c46b]"}`}>
      <form action={action} onChange={() => { setChanged(true); setShowSaved(false); }}
        className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto] md:items-end">
        <input type="hidden" name="id" value={p.id} />
        <div className="flex flex-col gap-1">
          <label htmlFor={`n-${p.id}`} className={label}>Name</label>
          <input id={`n-${p.id}`} name="full_name" defaultValue={p.full_name ?? ""} placeholder="Add their name" className={field} />
          <span className="truncate text-xs text-muted">{p.email}</span>
        </div>
        <div className="flex flex-col gap-1 md:pb-5">
          <label htmlFor={`t-${p.id}`} className={label}>Job title</label>
          <input id={`t-${p.id}`} name="job_title" defaultValue={p.job_title ?? ""} placeholder={p.role?.name ?? "e.g. Lead installer"} className={field} />
        </div>
        <div className="flex flex-col gap-1 md:pb-5">
          <label htmlFor={`r-${p.id}`} className={label}>Reports to</label>
          <select id={`r-${p.id}`} name="reports_to" defaultValue={p.reports_to ?? ""} className={field}>
            <option value="">Their department manager</option>
            {others.map((x) => <option key={x.id} value={x.id}>{nameOf(x)}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 md:pb-5">
          <label htmlFor={`ro-${p.id}`} className={label}>Role (what they can see)</label>
          <select id={`ro-${p.id}`} name="role_id" defaultValue={p.role?.id ?? ""} className={field}>
            <option value="">No role yet</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}{r.department ? ` (${r.department.name})` : ""}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 md:mb-5">
          {showSaved ? (
            <span role="status" className="flex h-10 items-center justify-center rounded-lg bg-[#e1f4e8] px-4 font-semibold text-[#12663a]">Saved ✓</span>
          ) : (
            <PendingButton pendingLabel="Saving…"
              className={`h-10 rounded-lg px-4 font-semibold ${changed ? "bg-[#c25508] text-white" : "text-accent ring-1 ring-accent"}`}>
              Save
            </PendingButton>
          )}
        </div>
      </form>
      {state.error && <p role="alert" className="mt-2 text-sm text-[#a3290f]">{state.error}</p>}
      {changed && !state.error && <p className="mt-1 text-xs font-semibold text-accent">Unsaved changes</p>}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3 border-t border-line pt-2">
        {children}
        {!isMe && (
          <form action={setPersonActive}
            onSubmit={(e) => { if (!window.confirm(`Remove ${nameOf(p)}? They won't be able to sign in. Their signed SOPs and certificates are kept, and you can restore them later.`)) e.preventDefault(); }}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="active" value="false" />
            <input type="hidden" name="name" value={nameOf(p)} />
            <PendingButton pendingLabel="Removing…" className="text-sm font-semibold text-[#a3290f] underline">Remove</PendingButton>
          </form>
        )}
      </div>
    </li>
  );
}
