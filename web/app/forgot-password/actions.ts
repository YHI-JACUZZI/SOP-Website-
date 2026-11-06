"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function sendReset(formData: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  await supabase.auth.resetPasswordForEmail(String(formData.get("email")), {
    redirectTo: `${origin}/auth/confirm?next=/update-password`,
  });

  // Same message whether or not the email exists, so the page can't be used
  // to check who has an account.
  redirect(
    "/forgot-password?notice=If that email has an account, a reset link is on its way. Check your inbox.",
  );
}
