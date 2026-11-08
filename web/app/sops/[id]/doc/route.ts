import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import { getSop } from "@/lib/sops";
import { modernizeSop } from "@/lib/sop-layout";

// Serves the SOP document itself, only after the database confirms this
// person may read it. Imported SOPs live in Supabase storage; the original
// three ship with the site as a fallback.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sop = await getSop(id);
  if (!sop) return new Response("Not found", { status: 404 });

  const html = await loadDoc(sop.id);
  if (html === null) return new Response("Not found", { status: 404 });

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      // The documents are plain pages: no scripts, nothing loaded from elsewhere.
      "Content-Security-Policy":
        "default-src 'none'; img-src data: 'self'; style-src 'unsafe-inline'; font-src data:; frame-ancestors 'self'",
    },
  });
}

async function loadDoc(id: string): Promise<string | null> {
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
