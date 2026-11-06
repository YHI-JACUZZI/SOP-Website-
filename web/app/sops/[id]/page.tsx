import Link from "next/link";
import { notFound } from "next/navigation";
import SignedInBar from "@/components/SignedInBar";
import { getMyProfile } from "@/lib/profile";
import { getSop } from "@/lib/sops";

export default async function SopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, sop] = await Promise.all([getMyProfile(), getSop(id)]);
  // Not found and not allowed look the same, so nobody can guess which SOPs exist.
  if (!sop) notFound();

  return (
    <div className="flex h-screen flex-col">
      <SignedInBar profile={profile} />
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline gap-x-4 gap-y-1 px-6 py-4">
        <Link href="/" className="text-sm font-medium text-accent">
          ← My SOPs
        </Link>
        <span className="font-mono text-xs tracking-wide text-accent">
          {sop.id} · Rev {sop.revision}
        </span>
        <h1 className="w-full font-display text-2xl font-bold">{sop.title}</h1>
      </div>
      <iframe
        title={sop.title}
        src={`/sops/${sop.id}/doc`}
        sandbox=""
        className="w-full flex-1 border-t border-line bg-white"
      />
    </div>
  );
}
