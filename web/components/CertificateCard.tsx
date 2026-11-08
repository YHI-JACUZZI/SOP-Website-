import { certNumber } from "@/lib/signoff";

// The printable certificate for a signed sign-off or a passed refresher.
export default function CertificateCard({
  kind, who, sopId, title, revision, signedName, completedAt, certificateId, score,
}: {
  kind: "signoff" | "refresher";
  who: string;
  sopId: string;
  title: string;
  revision: string;
  signedName: string;
  completedAt: string;
  certificateId: string;
  score: number | null;
}) {
  const date = new Date(completedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return (
    <article className="relative flex flex-col items-center gap-5 overflow-hidden rounded-2xl bg-white px-6 py-12 text-center text-[#141414] shadow-sm ring-1 ring-[#e1dcd6] sm:px-14 print:shadow-none">
      <div aria-hidden className="absolute inset-x-0 top-0 h-2 bg-[#111]" />
      <div aria-hidden className="absolute inset-x-0 top-2 h-1 bg-[#f47c20]" />
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#c25508]">Yancey Home Improvements</p>
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
        {kind === "refresher" ? "Certificate of Refresher Training" : "Certificate of Completion"}
      </h1>
      <p className="text-[#5e5a56]">This certifies that</p>
      <p className="font-display text-2xl font-bold">{who}</p>
      <p className="max-w-md text-[#5e5a56]">
        {kind === "refresher" ? "has reviewed and passed the refresher for" : "has read, understood and signed off on"}
      </p>
      <p className="max-w-md">
        <span className="block font-mono text-xs tracking-wide text-[#c25508]">{sopId} · Revision {revision}</span>
        <span className="font-display text-xl font-bold">{title}</span>
      </p>
      {score !== null && <p className="text-sm text-[#5e5a56]">Quiz score {score}%</p>}

      <div className="mt-4 grid w-full max-w-lg grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="flex flex-col items-center">
          <span className="font-signature min-h-14 whitespace-nowrap text-4xl leading-tight sm:text-[2.6rem]">{signedName}</span>
          <span className="w-full border-t border-[#141414]/60 pt-1 text-xs uppercase tracking-wide text-[#5e5a56]">Signature</span>
        </div>
        <div className="flex flex-col items-center justify-end">
          <span className="min-h-14 content-end pb-2 text-lg font-semibold">{date}</span>
          <span className="w-full border-t border-[#141414]/60 pt-1 text-xs uppercase tracking-wide text-[#5e5a56]">Date</span>
        </div>
      </div>
      <p className="font-mono text-[11px] tracking-wide text-[#5e5a56]">Certificate no. {certNumber(certificateId)}</p>
    </article>
  );
}
