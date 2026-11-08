import "server-only";
import { createClient } from "@/lib/supabase/server";

// Sends through Resend (resend.com) once RESEND_API_KEY and EMAIL_FROM are set
// in Vercel. Until then nothing is sent, but every attempt is still written to
// the email log so admins can see who would have been told.
export async function sendEmail(to: string[], subject: string, html: string, text: string) {
  if (to.length === 0) return;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  let status = "not sent";
  let detail = "Email isn't set up yet (RESEND_API_KEY and EMAIL_FROM).";
  if (key && from) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, html, text }),
      });
      status = res.ok ? "sent" : "failed";
      detail = res.ok ? "" : `${res.status} ${(await res.text()).slice(0, 300)}`;
    } catch (e) {
      status = "failed";
      detail = String(e).slice(0, 300);
    }
  }
  const supabase = await createClient();
  await supabase.from("email_log").insert(to.map((to_email) => ({ to_email, subject, status, detail })));
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
