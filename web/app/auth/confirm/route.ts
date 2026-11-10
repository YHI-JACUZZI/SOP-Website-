import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["invite", "recovery", "signup", "magiclink", "email", "email_change"];
const safe = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
const expired = (origin: string) =>
  NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("That link has expired or was already used. Ask for a new one.")}`,
    { status: 303 },
  );

// Opening a sign-in link only shows a "Continue" page. Text apps, Teams and
// email scanners open links to preview them, and that used to spend the
// one-time token before the person ever clicked it.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? expired(origin) : NextResponse.redirect(`${origin}${safe(searchParams.get("next"))}`);
  }
  return NextResponse.redirect(`${origin}/auth/accept?${searchParams.toString()}`);
}

// The person pressed Continue: now check the token and sign them in.
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "") as EmailOtpType;
  if (!tokenHash || !TYPES.includes(type)) return expired(origin);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return expired(origin);
  return NextResponse.redirect(`${origin}${safe(String(form.get("next") ?? ""))}`, { status: 303 });
}
