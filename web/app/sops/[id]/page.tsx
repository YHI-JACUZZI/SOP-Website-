import Link from "next/link";
import { notFound } from "next/navigation";
import RefresherForm from "@/components/RefresherForm";
import SignedInBar from "@/components/SignedInBar";
import SignOffForm from "@/components/SignOffForm";
import { getMyProfile } from "@/lib/profile";
import { PASS_MARK, refresherStatement, signOffStatement } from "@/lib/signoff";
import { changesSince, loadDoc, revisionHistory, type RevisionRow } from "@/lib/sopDoc";
import { getSop } from "@/lib/sops";
import { createClient } from "@/lib/supabase/server";
import { isAssigned, shortDate, statusFor, STATUS_STYLE, type Assignment, type Refresher } from "@/lib/tracking";
import { markComplete, undoComplete } from "./actions";

type MyCompletion = {
  sop_id: string; person_id: string; revision: string; completed_at: string;
  signed_name: string | null; certificate_id: string;
};

export default async function SopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, sop] = await Promise.all([getMyProfile(), getSop(id)]);
  // Not found and not allowed look the same, so nobody can guess which SOPs exist.
  if (!sop) notFound();

  const supabase = await createClient();
  const me = profile?.id ?? "";
  const roleId = profile?.role?.id ?? null;
  const [, { data: completions }, { data: assignments }, { data: refreshers }, { data: canEditQuiz }] = await Promise.all([
    // Record that this person opened it ("In progress" on the team dashboard).
    profile
      ? supabase.from("sop_views").upsert({ sop_id: sop.id, person_id: me, last_viewed_at: new Date().toISOString() }, { onConflict: "sop_id,person_id" })
      : Promise.resolve(null),
    supabase.from("completions").select("sop_id, person_id, revision, completed_at, signed_name, certificate_id")
      .eq("sop_id", sop.id).eq("person_id", me).order("completed_at").returns<MyCompletion[]>(),
    supabase.from("assignments").select("id, sop_id, person_id, role_id, due_date, refresh_months").eq("sop_id", sop.id).returns<Assignment[]>(),
    supabase.from("refreshers").select("sop_id, person_id, revision, score, passed, completed_at")
      .eq("sop_id", sop.id).eq("person_id", me).order("completed_at").returns<Refresher[]>(),
    supabase.rpc("can_edit_quiz", { sop: sop.id }).returns<boolean>(),
  ]);
  const C = completions ?? [], A = assignments ?? [], R = refreshers ?? [];
  const assigned = !!profile && isAssigned(sop.id, me, roleId, A);
  const st = statusFor({ sopId: sop.id, revision: sop.revision, personId: me, roleId, completions: C, views: [], assignments: A, refreshers: R });
  const current = C.find((c) => c.revision === sop.revision) ?? null;
  const lastSigned = [...C].reverse().find((c) => c.signed_name) ?? null;
  const suggested = profile?.full_name ?? "";

  const needsSign = assigned && !current;
  const needsRefresh = st.status === "refresh";
  let changes: RevisionRow[] = [];
  if ((needsSign && lastSigned) || needsRefresh) {
    const html = await loadDoc(sop.id);
    changes = html ? changesSince(revisionHistory(html), lastSigned?.revision ?? null) : [];
  }
  const questions = needsRefresh
    ? ((await supabase.rpc("quiz_for", { sop: sop.id })).data as { id: number; question: string; choices: string[] }[] | null) ?? []
    : [];
  const quizCount = canEditQuiz ? (await supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("sop_id", sop.id)).count ?? 0 : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={profile} />
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-4">
            <Link href="/" className="text-sm font-medium text-accent">← My SOPs</Link>
            <span className="font-mono text-xs tracking-wide text-accent">{sop.id} · Rev {sop.revision}</span>
          </div>
          <h1 className="font-display text-2xl font-bold">{sop.title}</h1>
        </div>
        {profile && (assigned ? (
          needsSign || needsRefresh ? (
            <a href="#sign-off" className="flex h-11 items-center rounded-lg bg-[#c25508] px-5 font-semibold text-white">
              {needsRefresh ? "Take refresher ↓" : "Sign off ↓"}
            </a>
          ) : (
            <span className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: STATUS_STYLE.done.bg, color: STATUS_STYLE.done.fg }}>
              ✓ Signed {current && shortDate(current.completed_at)}
            </span>
          )
        ) : current ? (
          <form action={undoComplete} className="flex items-center gap-3">
            <input type="hidden" name="id" value={sop.id} />
            <span className="rounded-lg bg-[#e1f4e8] px-3 py-2 text-sm font-semibold text-[#12663a]">
              ✓ Completed {shortDate(current.completed_at)}
            </span>
            {!current.signed_name && <button type="submit" className="text-sm text-muted underline">Undo</button>}
          </form>
        ) : (
          <form action={markComplete}>
            <input type="hidden" name="id" value={sop.id} />
            <button type="submit" className="h-11 rounded-lg bg-[#c25508] px-5 font-semibold text-white">Mark as complete</button>
          </form>
        ))}
      </div>
      <iframe
        title={sop.title}
        src={`/sops/${sop.id}/doc`}
        sandbox=""
        className={`w-full border-y border-line bg-white ${assigned || canEditQuiz ? "h-[75vh] min-h-[480px]" : "flex-1 min-h-[80vh]"}`}
      />

      {(assigned || canEditQuiz) && (
        <section id="sign-off" className="mx-auto flex w-full max-w-3xl scroll-mt-4 flex-col gap-5 px-6 py-10">
          {needsRefresh ? (
            <>
              <div>
                <h2 className="font-display text-2xl font-bold">Refresher</h2>
                <p className="text-muted">
                  Due {st.due && shortDate(st.due)}. Read through the SOP above again, answer the questions and sign.
                </p>
              </div>
              <Changes rows={changes} lastRev={lastSigned?.revision ?? null} lastDate={lastSigned?.completed_at ?? null} />
              <RefresherForm sopId={sop.id} statement={refresherStatement(sop)} suggested={suggested} questions={questions} passMark={PASS_MARK} />
            </>
          ) : needsSign ? (
            <>
              <div>
                <h2 className="font-display text-2xl font-bold">Sign off</h2>
                <p className="text-muted">
                  This SOP is assigned to you{st.due ? `, due ${shortDate(st.due)}` : ""}. When you&apos;ve read it, sign below.
                </p>
              </div>
              {lastSigned && <Changes rows={changes} lastRev={lastSigned.revision} lastDate={lastSigned.completed_at} />}
              <SignOffForm sopId={sop.id} statement={signOffStatement(sop)} suggested={suggested} />
            </>
          ) : assigned && current ? (
            <div className="flex flex-col gap-3 rounded-xl bg-surface p-5 ring-1 ring-line">
              <h2 className="font-display text-xl font-bold">Signed off</h2>
              {current.signed_name ? (
                <>
                  <span className="font-signature text-5xl leading-tight">{current.signed_name}</span>
                  <p className="text-sm text-muted">
                    Signed {shortDate(current.completed_at)} for Revision {sop.revision}.
                    {st.nextRefresh && ` Next refresher due ${shortDate(st.nextRefresh)}.`}
                  </p>
                  <Link href={`/certificates/${current.certificate_id}`} className="self-start font-semibold text-accent underline">
                    View certificate →
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted">Marked complete {shortDate(current.completed_at)}, before signatures were added.</p>
              )}
            </div>
          ) : null}

          {canEditQuiz && (
            <p className="text-sm text-muted">
              Refresher quiz: {quizCount} question{quizCount === 1 ? "" : "s"}.{" "}
              <Link href={`/sops/${sop.id}/quiz`} className="font-semibold text-accent underline">Edit quiz</Link>
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function Changes({ rows, lastRev, lastDate }: { rows: RevisionRow[]; lastRev: string | null; lastDate: string | null }) {
  if (!lastRev) return null;
  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-line">
      <h3 className="font-semibold">What changed since you signed Revision {lastRev}{lastDate && ` on ${shortDate(lastDate)}`}</h3>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-muted">Nothing. The SOP hasn&apos;t changed since then.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {rows.map((r) => (
            <li key={r.rev}>
              <span className="font-mono text-xs text-accent">Rev {r.rev}{r.date && ` · ${r.date}`}</span> {r.change}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
