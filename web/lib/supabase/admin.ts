import "server-only";
import { createClient } from "@supabase/supabase-js";

// Full-access client for admin-only jobs like sending invites. Uses the
// secret key, so it must only ever run on the server.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
