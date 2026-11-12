import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  active: boolean;
  last_seen_at?: string | null;
  role: {
    id: number;
    name: string;
    is_admin: boolean;
    is_manager: boolean;
    department: { id: number; name: string } | null;
  } | null;
};

export const PROFILE_FIELDS =
  "id, email, full_name, active, role:roles(id, name, is_admin, is_manager, department:departments(id, name))";

// The signed-in person's profile, or null if they aren't signed in
// (or the Phase 3 database setup hasn't been run yet).
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Also note that they're active (for "Online now"); at most once a minute.
  const [{ data }] = await Promise.all([
    supabase.from("profiles").select(PROFILE_FIELDS).eq("id", user.id).maybeSingle<Profile>(),
    supabase.rpc("touch_last_seen"),
  ]);
  return data;
}
