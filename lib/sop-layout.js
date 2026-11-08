// Generated from web/lib/sop-layout.ts (types removed). Keep the two in step.
// Brings an SOP page (pandoc output in the Yancey layout) up to the current
// template, as Mike marked it up on 2026-11-07:
//  - no orange running header bar, no "STANDARD OPERATING PROCEDURE" line
//  - Department, SOP ID and Revision each on their own line
//  - Table of Contents lists every section as a link
//  - no "Publishing & Use Checklist" section
//  - Records & Documentation and Approval & Sign-off always present
//  - Approval & Sign-off, then the Document Control table, at the very end
// Safe to run more than once: an up-to-date page comes back unchanged.
// Plain string work so it runs in the browser, on the server and in scripts.

const SOP_LAYOUT_CSS = `body { padding-top: 28px; }
.sopmeta { color: #666666; font-size: .85rem; margin: .6em 0 18px; padding-bottom: 18px; border-bottom: 2px solid #F47C20; }
.sopmeta p { margin: 0; }
.toc { margin: 0 0 8px; }
.toc a { display: block; color: #1F1F1F; text-decoration: none; padding: 3px 0; border-bottom: 1px dotted #D9D9D9; }
.toc a:hover { color: #E36C0A; }
h1[id] { scroll-margin-top: 12px; }`;

const APPROVAL = `<h1 id="approval-sign-off">Approval &amp; Sign-off</h1>
<table>
<colgroup><col style="width: 25%" /><col style="width: 25%" /><col style="width: 25%" /><col style="width: 24%" /></colgroup>
<thead><tr class="header"><th><strong>Role</strong></th><th><strong>Name</strong></th><th><strong>Approval / Signature</strong></th><th><strong>Date</strong></th></tr></thead>
<tbody>
<tr class="odd"><td>Prepared by</td><td>[Name]</td><td>[Signature or approval record]</td><td>[Date]</td></tr>
<tr class="even"><td>Reviewed by</td><td>[Name]</td><td>[Signature or approval record]</td><td>[Date]</td></tr>
<tr class="odd"><td>Approved by</td><td>[Name]</td><td>[Signature or approval record]</td><td>[Date]</td></tr>
</tbody>
</table>`;

const RECORDS = `<h1 id="records-documentation">9. Records &amp; Documentation</h1>
<p>List records created, where they are stored, who owns them, and retention or access requirements.</p>
`;

const clean = (s        ) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const escAttr = (s        ) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function sopMetaHtml(dept        , id        , rev        )         {
  const e = (s        ) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<div class="sopmeta"><p>Department: ${e(dept)}</p><p>SOP ID: ${e(id)}</p><p>Revision: ${e(rev)}</p></div>`;
}

function modernizeSop(html        )         {
  let s = html;

  // Styles: swap the old header-line rules for the new ones
  if (!s.includes(".sopmeta {")) {
    s = s.replace(/div\[data-custom-style="Title"\] \+ p \+ p \{[^}]*\}\s*/g, "");
    s = s.replace(/div\[data-custom-style="Title"\] \+ p \{[^}]*\}\s*/g, "");
    s = s.replace(/<\/style>(?![\s\S]*<\/style>)/, SOP_LAYOUT_CSS + "\n</style>");
  }

  // Header
  s = s.replace(/<div class="runhead">[\s\S]*?<\/div>\s*/g, "");
  s = s.replace(/<p><strong>STANDARD OPERATING PROCEDURE<\/strong><\/p>\s*/g, "");
  s = s.replace(
    /<p>Department:\s*([\s\S]*?)\s*•\s*SOP ID:\s*([\s\S]*?)\s*•\s*Revision:\s*([\s\S]*?)<\/p>/,
    (_m, d        , i        , r        ) =>
      `<div class="sopmeta"><p>Department: ${d.trim()}</p><p>SOP ID: ${i.trim()}</p><p>Revision: ${r.trim()}</p></div>`,
  );

  // Section 12 goes
  s = s.replace(/<h1 id="publishing-use-checklist">[\s\S]*?<\/h1>\s*(?:<p>☐[\s\S]*?<\/p>\s*)*/g, "");

  // Records & Documentation before Related Documents, if missing
  if (!/<h1[^>]*>\s*\d+\.\s*Records &amp;\s+Documentation/.test(s)) {
    s = s.replace(/<h1 id="related-documents-references">/, RECORDS + '<h1 id="related-documents-references">');
  }
  // Number the sections 1, 2, 3… in order
  let n = 0;
  s = s.replace(/(<h1 id="[^"]*">)\s*\d+\.\s*/g, (_m, open        ) => `${open}${++n}. `);

  // Approval & Sign-off, then Document Control, after the Revision History table
  const apRe = /<h1 id="approval-sign-off">[\s\S]*?<\/h1>\s*<table>[\s\S]*?<\/table>\s*/;
  const dcRe = /<table>(?:(?!<table>)[\s\S])*?DOCUMENT CONTROL[\s\S]*?<\/table>\s*/;
  const ap = (s.match(apRe)?.[0] ?? APPROVAL).trim();
  const dc = s.match(dcRe)?.[0]?.trim() ?? "";
  s = s.replace(apRe, "").replace(dcRe, "");
  const rh = s.search(/<h1 id="revision-history">/);
  if (rh >= 0) {
    const end = s.indexOf("</table>", rh);
    if (end >= 0) {
      const at = end + "</table>".length;
      s = s.slice(0, at) + "\n" + ap + "\n" + dc + s.slice(at);
    }
  }

  // Table of Contents: a link to every section after it
  const tocHead = s.match(/<h1 id="table-of-contents">[\s\S]*?<\/h1>/);
  if (tocHead) {
    const start = s.indexOf(tocHead[0]) + tocHead[0].length;
    const rest = s.slice(start);
    const links = [...rest.matchAll(/<h1 id="([^"]+)">([\s\S]*?)<\/h1>/g)]
      .map((m) => `<a href="#${escAttr(m[1])}" target="_self">${clean(m[2]).replace(/&(?!amp;|lt;|gt;|quot;|#)/g, "&amp;")}</a>`)
      .join("\n");
    const nav = `\n<nav class="toc">\n${links}\n</nav>\n`;
    const body = rest
      .replace(/^\s*<nav class="toc">[\s\S]*?<\/nav>\s*/, "")
      .replace(/^\s*<p><em>Before publishing[\s\S]*?<\/em><\/p>\s*/, "");
    s = s.slice(0, start) + nav + body;
  }
  return s;
}

window.modernizeSop = modernizeSop; window.sopMetaHtml = sopMetaHtml;
