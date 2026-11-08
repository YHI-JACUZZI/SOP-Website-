import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { modernizeSop } from "@/lib/sop-layout";
import { createClient } from "@/lib/supabase/server";

// The SOP document's HTML. Imported SOPs live in Supabase storage; the
// original three ship with the site as a fallback. Callers must check the
// person may read the SOP first (getSop does).
export async function loadDoc(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from("sop-docs").download(`${id}.html`);
  // Copies imported before the 2026-11-07 template change get the new layout on the way out.
  if (data) return modernizeSop(await data.text());

  try {
    return await readFile(path.join(process.cwd(), "content/sops", `${id}.html`), "utf8");
  } catch {
    return null;
  }
}

export type RevisionRow = { rev: string; date: string; change: string; by: string };

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

// Rows of the "Revision History" table in the SOP template, oldest first.
export function revisionHistory(html: string): RevisionRow[] {
  // The heading, not the table-of-contents link to it.
  const at = html.search(/<h[1-6][^>]*>(?:(?!<\/h[1-6]>)[\s\S])*Revision History/i);
  if (at < 0) return [];
  const table = html.slice(at).match(/<table[\s\S]*?<\/table>/i)?.[0];
  if (!table) return [];
  return Array.from(table.matchAll(/<tr[\s\S]*?<\/tr>/gi))
    .filter((m) => !/<th/i.test(m[0]))
    .map((m) => Array.from(m[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((c) => text(c[1])))
    .filter((c) => c.length >= 3 && c[0] && !/^rev/i.test(c[0]) && c[2] && !c[2].startsWith("["))
    .map((c) => ({ rev: c[0], date: c[1] ?? "", change: c[2] ?? "", by: c[3] ?? "" }));
}

// What changed after the revision someone last signed.
export function changesSince(rows: RevisionRow[], lastRev: string | null): RevisionRow[] {
  if (!lastRev) return [];
  const i = rows.findIndex((r) => r.rev === lastRev);
  return i >= 0 ? rows.slice(i + 1) : rows.filter((r) => r.rev !== lastRev);
}
