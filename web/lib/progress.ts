import type { Profile } from "@/lib/profile";
import { listMySops } from "@/lib/sops";
import { createClient } from "@/lib/supabase/server";
import { isAssigned, statusFor, type Assignment, type Completion, type Refresher, type View } from "@/lib/tracking";

export type MyProgress = { total: number; done: number; open: number; overdue: number };

// The signed-in person's own training numbers, for the side menu's badge and
// progress circle. Uses the same rules as My dashboard.
export async function getMyProgress(profile: Profile | null): Promise<MyProgress> {
  const empty = { total: 0, done: 0, open: 0, overdue: 0 };
  if (!profile) return empty;
  const me = profile.id;
  const roleId = profile.role?.id ?? null;
  const supabase = await createClient();
  const [sops, { data: completions }, { data: views }, { data: assignments }, { data: refreshers }] = await Promise.all([
    listMySops(),
    supabase.from("completions").select("sop_id, person_id, revision, completed_at").eq("person_id", me).returns<Completion[]>(),
    supabase.from("sop_views").select("sop_id, person_id, first_viewed_at, last_viewed_at").eq("person_id", me).returns<View[]>(),
    supabase.from("assignments").select("id, sop_id, person_id, role_id, due_date, refresh_months").returns<Assignment[]>(),
    supabase.from("refreshers").select("sop_id, person_id, revision, score, passed, completed_at").eq("person_id", me).returns<Refresher[]>(),
  ]);
  const A = assignments ?? [];
  const statuses = sops
    .filter((sop) => sop.kind === "sop" || isAssigned(sop.id, me, roleId, A))
    .map((sop) =>
      statusFor({
        sopId: sop.id, revision: sop.revision, personId: me, roleId,
        completions: completions ?? [], views: views ?? [], assignments: A, refreshers: refreshers ?? [],
      }).status,
    );
  const done = statuses.filter((s) => s === "done").length;
  return {
    total: statuses.length,
    done,
    open: statuses.length - done,
    overdue: statuses.filter((s) => s === "overdue").length,
  };
}
