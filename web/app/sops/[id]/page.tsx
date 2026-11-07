import Link from "next/link";
import { notFound } from "next/navigation";
import SignedInBar from "@/components/SignedInBar";
import { getMyProfile } from "@/lib/profile";
import { getSop } from "@/lib/sops";
import { createClient } from "@/lib/supabase/server";
import { shortDate } from "@/lib/tracking";
import { markComplete, undoComplete } from "./actions";

export default async function SopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, sop] = await Promise.all([getMyProfile(), getSop(id)]);
  // Not found and not allowed look the same, so nobody can guess which SOPs exist.
  if (!sop) notFound();

  // Record that this person opened it ("In progress" on the team dashboard).
  const supabase = await createClient();
  let done: { completed_at: string } | null = null;
  if (profile) {
    const now = new Date().toISOString();
    const [, { data }] = await Promise.all([
      supabase.from("sop_views").upsert({ sop_id: sop.id, person_id: profile.id, last_viewed_at: now }, { onConflict: "sop_id,person_id" }),
      supabase
        .from("completions")
        .select("completed_at")
        .eq("sop_id", sop.id)
        .eq("person_id", profile.id)
        .eq("revision", sop.revision)
        .maybeSingle<{ completed_at: string }>(),
    ]);
    done = data;
  }

  return (
    <div className="flex h-screen flex-col">
      <SignedInBar profile={profile} />
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-4">
            <Link href="/" className="text-sm font-medium text-accent">
              ← My SOPs
            </Link>
            <span className="font-mono text-xs tracking-wide text-accent">
              {sop.id} · Rev {sop.revision}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold">{sop.title}</h1>
        </div>
        {profile &&
          (done ? (
            <form action={undoComplete} className="flex items-center gap-3">
              <input type="hidden" name="id" value={sop.id} />
              <span className="rounded-lg bg-[#e1f4e8] px-3 py-2 text-sm font-semibold text-[#12663a]">
                ✓ Completed {shortDate(done.completed_at)}
              </span>
              <button type="submit" className="text-sm text-muted underline">Undo</button>
            </form>
          ) : (
            <form action={markComplete}>
              <input type="hidden" name="id" value={sop.id} />
              <button type="submit" className="h-11 rounded-lg bg-[#c25508] px-5 font-semibold text-white">
                Mark as complete
              </button>
            </form>
          ))}
      </div>
      <iframe
        title={sop.title}
        src={`/sops/${sop.id}/doc`}
        sandbox=""
        className="w-full flex-1 border-t border-line bg-white"
      />
    </div>
  );
}
