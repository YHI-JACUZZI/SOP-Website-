"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SopRow = { id: string; title: string; revision: string; department_id: number | null; status: string };
type Role = { id: number; name: string; department_id: number | null };
type Department = { id: number; name: string };
type Step = { html: string; imgs: string[] };
type Parsed = { title: string; desc: string; steps: Step[] };

const SOP_ID = /^SOP-[A-Z]{3}-\d{3}$/;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const today = () => {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${z(d.getMonth() + 1)}-${z(d.getDate())}-${String(d.getFullYear()).slice(2)}`;
};

const nextRev = (rev: string) => String(Number(rev || "0") + 1).padStart(2, "0");

// Shrink screenshots so a 30-step SOP stays a few MB.
function shrink(src: string): Promise<string> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1400 / im.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(im.naturalWidth * k);
      c.height = Math.round(im.naturalHeight * k);
      const g = c.getContext("2d")!;
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(im, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    im.onerror = () => resolve(src);
    im.src = src;
  });
}

// Scribe layout: heading 1 = title, heading 2 = description, then numbered
// steps, each followed by its screenshot.
async function parseScribe(buf: ArrayBuffer): Promise<Parsed> {
  const mammoth = (await import("mammoth")).default;
  const out = await mammoth.convertToHtml({ arrayBuffer: buf });
  const d = new DOMParser().parseFromString(out.value, "text/html");
  const junk = (t: string) => /scribehow\.com|made with scribe|never miss a step/i.test(t);
  let title = "";
  let desc = "";
  const steps: Step[] = [];

  for (const n of Array.from(d.body.children)) {
    const txt = (n.textContent ?? "").trim();
    if (/^H[1-6]$/.test(n.tagName) && !title) { title = txt; continue; }
    if (/^H[1-6]$/.test(n.tagName) && !desc && !steps.length) { desc = txt; continue; }
    if (n.tagName === "OL" || n.tagName === "UL") {
      for (const li of Array.from(n.querySelectorAll(":scope > li"))) {
        const imgs = Array.from(li.querySelectorAll("img")).map((i) => i.src);
        li.querySelectorAll("img").forEach((i) => i.remove());
        steps.push({ html: li.innerHTML.trim(), imgs });
      }
      continue;
    }
    const imgs = Array.from(n.querySelectorAll("img")).map((i) => i.src);
    if (imgs.length) {
      if (steps.length) steps[steps.length - 1].imgs.push(...imgs);
      continue;
    }
    if (!txt || junk(txt)) continue;
    if (!steps.length && !desc) { desc = txt; continue; }
    if (steps.length) steps[steps.length - 1].html += "<br>" + n.innerHTML;
    else desc += " " + txt;
  }
  for (const st of steps) st.imgs = await Promise.all(st.imgs.map(shrink));
  return { title, desc, steps };
}

type Fields = {
  id: string; title: string; dept: string; rev: string; date: string; by: string;
  why: string; status: string; supersedes: string; desc: string; steps: Step[];
};

// Put the Scribe content into the Yancey SOP layout: the SOP's current
// version if it has one, otherwise the blank template.
function buildSop(base: string, f: Fields): string {
  const d = new DOMParser().parseFromString(base, "text/html");
  const H = (re: RegExp) => Array.from(d.querySelectorAll("h1")).find((h) => re.test(h.textContent ?? ""));
  const mk = (html: string) => {
    const t = d.createElement("template");
    t.innerHTML = html.trim();
    return Array.from(t.content.childNodes).filter((x): x is Element => x.nodeType === 1);
  };
  const setBody = (h: Element, nodes: Element[], keepFirst: boolean) => {
    let n = h.nextElementSibling;
    if (keepFirst && n && n.tagName === "P") n = n.nextElementSibling;
    while (n && n.tagName !== "H1" && !n.classList.contains("runfoot")) {
      const nx = n.nextElementSibling;
      n.remove();
      n = nx;
    }
    nodes.forEach((x) => h.parentNode!.insertBefore(x, n));
  };
  const row = (re: RegExp, v?: string) => {
    const tr = Array.from(d.querySelectorAll("tr")).find((r) => r.cells.length > 1 && re.test(r.cells[0].textContent ?? ""));
    if (tr && v) tr.cells[1].textContent = v;
    return tr;
  };

  d.title = f.title;
  const ht = d.querySelector("h1.title");
  if (ht) ht.textContent = f.title;
  const tt = d.querySelector('[data-custom-style="Title"]');
  if (tt) tt.innerHTML = `<p>${esc(f.title)}</p>`;
  const meta = Array.from(d.querySelectorAll("p")).find((p) => /SOP ID:/.test(p.textContent ?? ""));
  if (meta) meta.textContent = `Department: ${f.dept} • SOP ID: ${f.id} • Revision: ${f.rev}`;
  const owner = row(/Document owner/i);
  if (owner && /^\[/.test(owner.cells[1].textContent!.trim()) && f.by) owner.cells[1].textContent = f.by;
  const po = row(/Process owner/i);
  if (po && /^\[/.test(po.cells[1].textContent!.trim())) po.cells[1].textContent = f.dept;
  row(/Effective date/i, f.date);
  row(/Document status/i, f.status);
  row(/Supersedes/i, f.supersedes);

  const hp = H(/Purpose/);
  if (hp && f.desc) setBody(hp, mk(`<p>${esc(f.desc)}</p>`), false);
  const hproc = H(/Procedure/);
  if (hproc) {
    setBody(
      hproc,
      f.steps.flatMap((st, i) =>
        mk(
          `<div data-custom-style="List Paragraph"><p><strong>${i + 1}.</strong> ${st.html}</p></div>` +
            st.imgs.map((src) => `<blockquote><p><img src="${src}" style="width:5.6in" alt="Step ${i + 1} screenshot"></p></blockquote>`).join(""),
        ),
      ),
      true,
    );
  }

  const hr = H(/Revision History/);
  const table = hr && Array.from(d.querySelectorAll("table")).find((t) => hr.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
  const tb = table?.tBodies[0];
  if (tb) {
    let r = Array.from(tb.rows).find((x) => /^\[|^$/.test(x.cells[1]?.textContent?.trim() ?? ""));
    if (!r) {
      r = tb.rows[tb.rows.length - 1].cloneNode(true) as HTMLTableRowElement;
      tb.appendChild(r);
    }
    [f.rev, f.date, f.why, f.by, ""].forEach((v, i) => { if (r!.cells[i]) r!.cells[i].textContent = v; });
  }
  return "<!doctype html>\n" + d.documentElement.outerHTML;
}

const label = "text-xs font-semibold uppercase tracking-wide text-muted";
const input = "h-10 rounded-lg border border-line bg-surface px-3";

export default function ImportForm({
  sops, roles, departments, sopRoles, me,
}: {
  sops: SopRow[];
  roles: Role[];
  departments: Department[];
  sopRoles: { sop_id: string; role_id: number }[];
  me: string;
}) {
  const router = useRouter();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [target, setTarget] = useState(""); // existing SOP id, or "" for a new one
  const [newId, setNewId] = useState("");
  const [title, setTitle] = useState("");
  const [deptId, setDeptId] = useState<number | "">("");
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [rev, setRev] = useState("00");
  const [by, setBy] = useState(me);
  const [why, setWhy] = useState("Imported from Scribe");
  const [status, setStatus] = useState<"published" | "draft">("published");
  const [preview, setPreview] = useState("");
  const [base, setBase] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const existing = sops.find((s) => s.id === target) ?? null;
  const id = existing ? existing.id : newId.trim().toUpperCase();
  const deptName = departments.find((d) => d.id === deptId)?.name ?? "";
  const roleNames = roles.filter((r) => roleIds.includes(r.id)).map((r) => r.name).join(", ");
  const ready = parsed && SOP_ID.test(id) && title.trim() && deptId !== "";

  const fields = useMemo<Fields | null>(() => {
    if (!parsed) return null;
    return {
      id: id || "[SOP-XXX]", title: title.trim() || parsed.title, rev, date: today(), by, why,
      status: status === "published" ? "Published" : "Draft",
      dept: [deptName, roleNames].filter(Boolean).join(" · "),
      supersedes: existing ? `${existing.id} Rev ${existing.revision}` : "N/A",
      desc: parsed.desc, steps: parsed.steps,
    };
  }, [parsed, id, title, rev, by, why, status, deptName, roleNames, existing]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setBusy("Reading the Word file…");
    try {
      const p = await parseScribe(await file.arrayBuffer());
      if (!p.steps.length) throw new Error("no steps");
      setParsed(p);
      if (!title) setTitle(p.title);
    } catch {
      setMessage({ ok: false, text: "Couldn't read that file. Use the .docx export from Scribe." });
    } finally {
      setBusy("");
    }
  }

  async function chooseTarget(value: string) {
    setTarget(value);
    setBase(null);
    const s = sops.find((x) => x.id === value);
    if (!s) { setRev("00"); return; }
    setTitle(s.title);
    setDeptId(s.department_id ?? "");
    setRoleIds(sopRoles.filter((r) => r.sop_id === s.id).map((r) => r.role_id));
    setRev(nextRev(s.revision));
    setWhy("Updated from Scribe export");
  }

  async function baseHtml(): Promise<string> {
    if (base !== null) return base;
    let html = "";
    if (existing) {
      const res = await fetch(`/sops/${existing.id}/doc`);
      if (res.ok) html = await res.text();
    }
    if (!html) html = await (await fetch("/sop-template.html")).text();
    setBase(html);
    return html;
  }

  async function makePreview() {
    if (!fields) return;
    setBusy("Building the preview…");
    setPreview(buildSop(await baseHtml(), fields));
    setBusy("");
  }

  async function publish() {
    if (!fields || !ready) return;
    setMessage(null);
    setBusy("Publishing…");
    const supabase = createClient();
    const oldHtml = existing ? await baseHtml() : "";
    const html = buildSop(await baseHtml(), fields);
    const docs = supabase.storage.from("sop-docs");
    const asHtml = (s: string) => new Blob([s], { type: "text/html" });

    try {
      if (existing && oldHtml) {
        const { error } = await docs.upload(`archive/${existing.id}-rev${existing.revision}-${Date.now()}.html`, asHtml(oldHtml));
        if (error) throw error;
      }
      const up = await docs.upload(`${id}.html`, asHtml(html), { upsert: true });
      if (up.error) throw up.error;

      const { error: sopError } = await supabase.from("sops").upsert({
        id, title: title.trim(), revision: rev, department_id: deptId, status, updated_at: new Date().toISOString(),
      });
      if (sopError) throw sopError;
      await supabase.from("sop_roles").delete().eq("sop_id", id);
      if (roleIds.length) {
        const { error } = await supabase.from("sop_roles").insert(roleIds.map((role_id) => ({ sop_id: id, role_id })));
        if (error) throw error;
      }
      setMessage({ ok: true, text: `${id} Rev ${rev} is ${status === "published" ? "published" : "saved as a draft"}.` });
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: `Didn't publish: ${(e as Error).message}` });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 rounded-xl bg-surface p-5 ring-1 ring-line">
        <div className="flex flex-col gap-1">
          <label htmlFor="file" className={label}>1. Scribe Word export (.docx)</label>
          <input id="file" type="file" accept=".docx" onChange={(e) => onFile(e.target.files?.[0])} />
          {parsed && <p className="text-sm text-muted">Found {parsed.steps.length} steps.</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="target" className={label}>2. Which SOP is this?</label>
          <select id="target" className={input} value={target} onChange={(e) => chooseTarget(e.target.value)}>
            <option value="">A new SOP</option>
            {sops.map((s) => (
              <option key={s.id} value={s.id}>Replace {s.id} · {s.title} (Rev {s.revision})</option>
            ))}
          </select>
          {!existing && (
            <input
              aria-label="New SOP ID"
              placeholder="New SOP ID, like SOP-PRD-003"
              className={input}
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
            />
          )}
          {existing && <p className="text-sm text-muted">The current version is kept in the archive.</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="title" className={label}>Title</label>
          <input id="title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="dept" className={label}>Department</label>
            <select id="dept" className={input} value={deptId} onChange={(e) => setDeptId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Choose…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="rev" className={label}>Revision</label>
            <input id="rev" className={input} value={rev} onChange={(e) => setRev(e.target.value)} />
          </div>
        </div>

        <fieldset className="flex flex-col gap-1">
          <legend className={label}>3. Who is it for?</legend>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-sm">
            {roles.filter((r) => r.department_id !== null).map((r) => (
              <label key={r.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={roleIds.includes(r.id)}
                  onChange={(e) => setRoleIds(e.target.checked ? [...roleIds, r.id] : roleIds.filter((x) => x !== r.id))}
                />
                {r.name}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted">Admins and the department&apos;s manager always see it.</p>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="by" className={label}>Revised by</label>
            <input id="by" className={input} value={by} onChange={(e) => setBy(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="status" className={label}>Status</label>
            <select id="status" className={input} value={status} onChange={(e) => setStatus(e.target.value as "published" | "draft")}>
              <option value="published">Published</option>
              <option value="draft">Draft (admins only)</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="why" className={label}>What changed</label>
          <input id="why" className={input} value={why} onChange={(e) => setWhy(e.target.value)} />
        </div>

        <div className="flex gap-3">
          <button type="button" disabled={!parsed || !!busy} onClick={makePreview}
            className="h-11 flex-1 rounded-lg font-semibold text-accent ring-1 ring-accent disabled:opacity-40">
            Preview
          </button>
          <button type="button" disabled={!ready || !!busy} onClick={publish}
            className="h-11 flex-1 rounded-lg bg-[#c25508] font-semibold text-white disabled:opacity-40">
            Publish
          </button>
        </div>
        {busy && <p role="status" className="text-sm text-muted">{busy}</p>}
        {message && (
          <p role="status" className={`rounded-lg p-3 text-sm ${message.ok ? "bg-[#e1f4e8] text-[#12663a]" : "bg-[#fbe4de] text-[#a3290f]"}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="min-h-[70vh] overflow-hidden rounded-xl bg-white ring-1 ring-line">
        {preview ? (
          <iframe title="SOP preview" srcDoc={preview} sandbox="" className="h-full min-h-[70vh] w-full" />
        ) : (
          <p className="p-6 text-muted">Upload a file and click Preview to see it in the template.</p>
        )}
      </div>
    </div>
  );
}
