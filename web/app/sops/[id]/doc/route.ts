import { getSop } from "@/lib/sops";
import { loadDoc } from "@/lib/sopDoc";

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

