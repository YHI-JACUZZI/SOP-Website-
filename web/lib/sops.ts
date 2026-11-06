import { createClient } from "@/lib/supabase/server";

export type Sop = {
  id: string;
  title: string;
  revision: string;
  status: string;
  department: { name: string } | null;
};

const SOP_FIELDS = "id, title, revision, status, department:departments(name)";

// SOP IDs look like SOP-PRD-001. Anything else is never a file we serve.
export const SOP_ID_PATTERN = /^SOP-[A-Z]{3}-\d{3}$/;

// Only returns SOPs the database's permission rules let this person see.
// Drafts come back for admins only.
export async function listMySops(): Promise<Sop[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sops")
    .select(SOP_FIELDS)
    .neq("status", "archived")
    .order("id")
    .returns<Sop[]>();
  return data ?? [];
}

export async function getSop(id: string): Promise<Sop | null> {
  if (!SOP_ID_PATTERN.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("sops")
    .select(SOP_FIELDS)
    .eq("id", id)
    .maybeSingle<Sop>();
  return data;
}
