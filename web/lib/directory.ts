import { createClient } from "@/lib/supabase/server";

export type Person = {
  id: string;
  full_name: string | null;
  email: string;
  role: string | null;
  is_manager: boolean;
  department_id: number | null;
  department: string | null;
  job_title: string | null;
  reports_to: string | null;
};

// Everyone active in the company (name, email, role, department).
export async function listPeople(): Promise<Person[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("people_directory");
  return (data as Person[] | null) ?? [];
}

export const displayName = (p: { full_name: string | null; email: string }) => p.full_name || p.email;

export const initials = (p: { full_name: string | null; email: string }) =>
  displayName(p)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
