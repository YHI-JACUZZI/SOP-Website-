import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSop } from "@/lib/sops";

// Serves the SOP document itself, only after the database confirms this
// person may read it.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sop = await getSop(id);
  if (!sop) return new Response("Not found", { status: 404 });

  const html = await readFile(path.join(process.cwd(), "content/sops", `${sop.id}.html`), "utf8");
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
