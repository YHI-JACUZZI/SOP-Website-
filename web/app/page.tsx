import Link from "next/link";
import SignedInBar from "@/components/SignedInBar";
import { getMyProfile } from "@/lib/profile";
import { listMySops } from "@/lib/sops";
import { createClient } from "@/lib/supabase/server";
import { certNumber } from "@/lib/signoff";
import { shortDate, statusFor, STATUS_STYLE, type Assignment, type Completion, type Refresher, type View } from "@/lib/tracking";

type Cert = { sop_id: string; revision: string; completed_at: string; certificate_id: string; sop: { title: string } | null };

const ORDER = { overdue: 0, refresh: 1, reread: 2, reading: 3, todo: 4, done: 5 } as const;

export default async function Home() {
  const supabase = await createClient();
  const profile = await getMyProfile();
  const me = profile?.id ?? "";
  const [sops, { data: completions }, { data: views }, { data: assignments }, { data: refreshers }, { data: signed }, { data: passed }] = await Promise.all([
    listMySops(),
    supabase.from("completions").select("sop_id, person_id, revision, completed_at").eq("person_id", me).returns<Completion[]>(),
    supabase.from("sop_views").select("sop_id, person_id, first_viewed_at, last_viewed_at").eq("person_id", me).returns<View[]>(),
    supabase.from("assignments").select("id, sop_id, person_id, role_id, due_date, refresh_months").returns<Assignment[]>(),
    supabase.from("refreshers").select("sop_id, person_id, revision, score, passed, completed_at").eq("person_id", me).returns<Refresher[]>(),
    supabase.from("completions").select("sop_id, revision, completed_at, certificate_id, sop:sops(title)")
      .eq("person_id", me).not("signed_name", "is", null).returns<Cert[]>(),
    supabase.from("refreshers").select("sop_id, revision, completed_at, certificate_id, sop:sops(title)")
      .eq("person_id", me).eq("passed", true).returns<Cert[]>(),
  ]);
  const certs = [
    ...(signed ?? []).map((c) => ({ ...c, kind: "Sign-off" })),
    ...(passed ?? []).map((c) => ({ ...c, kind: "Refresher" })),
  ].sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  const name = profile?.full_name || profile?.email;
  const rows = sops
    .map((sop) => ({
      sop,
      ...statusFor({
        sopId: sop.id, revision: sop.revision, personId: profile?.id ?? "", roleId: profile?.role?.id ?? null,
        completions: completions ?? [], views: views ?? [], assignments: assignments ?? [], refreshers: refreshers ?? [],
      }),
    }))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.due ?? "9").localeCompare(b.due ?? "9") || a.sop.id.localeCompare(b.sop.id));
  const left = rows.filter((r) => r.status !== "done").length;

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={profile} />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-6 py-12">
        <h1 className="font-display text-3xl font-bold">Hi, {name}</h1>
        {profile?.role ? (
          <p className="text-muted">
            {profile.role.name}
            {profile.role.department && ` · ${profile.role.department.name}`}
          </p>
        ) : (
          <p className="rounded-lg bg-[#fff3d6] p-4 text-sm text-[#6b3f00]">
            You don&apos;t have a role yet. An admin needs to pick one for you
            before your SOPs show up.
          </p>
        )}

        <h2 className="mt-4 font-display text-xl font-bold">My SOPs</h2>
        {sops.length > 0 && (
          <p className="-mt-2 text-sm text-muted">
            {left === 0 ? "You're all caught up." : `${left} of ${sops.length} still to finish.`}
          </p>
        )}
        {sops.length === 0 ? (
          <p className="rounded-lg bg-surface p-4 text-sm text-muted ring-1 ring-line">
            No SOPs for your role yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map(({ sop, status, date, due, nextRefresh }) => (
              <li key={sop.id}>
                <Link
                  href={`/sops/${sop.id}`}
                  className="flex flex-col gap-0.5 rounded-xl bg-surface px-4 py-3.5 ring-1 ring-line hover:ring-accent"
                >
                  <span className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-accent">
                    {sop.id}
                    {sop.status === "draft" && (
                      <span className="rounded bg-[#fff3d6] px-1.5 py-0.5 text-[#6b3f00]">DRAFT</span>
                    )}
                  </span>
                  <span className="font-semibold">{sop.title}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span
                      className="rounded-md px-2 py-0.5 text-[13px] font-semibold"
                      style={{ background: STATUS_STYLE[status].bg, color: STATUS_STYLE[status].fg }}
                    >
                      {STATUS_STYLE[status].text}
                      {date && ` ${shortDate(date)}`}
                    </span>
                    {due && status !== "done" && <span>Due {shortDate(due)}</span>}
                    {status === "done" && nextRefresh && <span>Refresher {shortDate(nextRefresh)}</span>}
                    <span>
                      Rev {sop.revision}
                      {sop.department && ` · ${sop.department.name}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {certs.length > 0 && (
          <>
            <h2 className="mt-6 font-display text-xl font-bold">My certificates</h2>
            <ul className="flex flex-col divide-y divide-line rounded-xl bg-surface ring-1 ring-line">
              {certs.map((c) => (
                <li key={c.certificate_id}>
                  <Link href={`/certificates/${c.certificate_id}`} className="flex flex-wrap items-baseline gap-x-3 px-4 py-3 hover:bg-background">
                    <span className="flex-1 font-semibold">{c.sop?.title ?? c.sop_id}</span>
                    <span className="text-sm text-muted">
                      {c.kind} · Rev {c.revision} · {shortDate(c.completed_at)}
                    </span>
                    <span className="sr-only">Certificate {certNumber(c.certificate_id)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
