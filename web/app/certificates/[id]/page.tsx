import Link from "next/link";
import { notFound } from "next/navigation";
import CertificateCard from "@/components/CertificateCard";
import PrintButton from "@/components/PrintButton";
import SignedInBar from "@/components/SignedInBar";
import { getMyProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

type Cert = {
  sop_id: string;
  revision: string;
  completed_at: string;
  signed_name: string | null;
  statement: string | null;
  certificate_id: string;
  score?: number;
  total?: number;
  passed?: boolean;
  sop: { title: string } | null;
  person: { full_name: string | null; email: string } | null;
};

const FIELDS = "sop_id, revision, completed_at, signed_name, statement, certificate_id, sop:sops(title), person:profiles(full_name, email)";

// A certificate for a signed sign-off or a passed refresher. The database's
// rules decide who can see it: the person, their manager and admins.
export default async function CertificatePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: fresh } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [profile, { data: signoff }, { data: refresher }] = await Promise.all([
    getMyProfile(),
    supabase.from("completions").select(FIELDS).eq("certificate_id", id).not("signed_name", "is", null).maybeSingle<Cert>(),
    supabase.from("refreshers").select(`${FIELDS}, score, total, passed`).eq("certificate_id", id).eq("passed", true).maybeSingle<Cert>(),
  ]);
  const cert = signoff ?? refresher;
  if (!cert) notFound();
  const isRefresher = !signoff;
  const who = cert.person?.full_name || cert.signed_name || cert.person?.email;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="print:hidden"><SignedInBar profile={profile} /></div>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8 sm:px-6 print:p-0">
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <Link href="/" className="flex-1 text-sm font-medium text-accent">← My SOPs</Link>
          <PrintButton />
        </div>
        {fresh && (
          <p role="status" className="rounded-lg bg-[#e1f4e8] p-3 text-sm font-semibold text-[#12663a] print:hidden">
            Signed and saved. This certificate is kept under My certificates on your home page, and your manager can see it too.
          </p>
        )}

        <CertificateCard
          kind={isRefresher ? "refresher" : "signoff"}
          who={who ?? ""}
          sopId={cert.sop_id}
          title={cert.sop?.title ?? cert.sop_id}
          revision={cert.revision}
          signedName={cert.signed_name ?? ""}
          completedAt={cert.completed_at}
          certificateId={cert.certificate_id}
          score={isRefresher && cert.total ? cert.score ?? null : null}
        />

        {cert.statement && (
          <details className="rounded-xl bg-surface p-4 text-sm ring-1 ring-line print:hidden">
            <summary className="cursor-pointer font-semibold">What was agreed when signing</summary>
            <p className="mt-2 leading-relaxed text-muted">{cert.statement}</p>
          </details>
        )}
      </main>
    </div>
  );
}
