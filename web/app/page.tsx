import Link from "next/link";
import SignedInBar from "@/components/SignedInBar";
import { getMyProfile } from "@/lib/profile";
import { listMySops } from "@/lib/sops";

export default async function Home() {
  const [profile, sops] = await Promise.all([getMyProfile(), listMySops()]);
  const name = profile?.full_name || profile?.email;

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={profile} />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-6 py-12">
        <h1 className="font-display text-3xl font-bold">Hi, {name}</h1>
        {profile?.role ? (
          <p className="text-muted">
            {profile.role.name}
            {profile.role.department && ` · ${profile.role.department.name}`}
          </p>
        ) : (
          <p className="rounded-lg bg-[#fff3d6] p-4 text-sm text-[#6b3f00]">
            You don&apos;t have a role yet. An admin needs to pick one for you
            before your SOPs show up.
          </p>
        )}

        <h2 className="mt-4 font-display text-xl font-bold">My SOPs</h2>
        {sops.length === 0 ? (
          <p className="rounded-lg bg-surface p-4 text-sm text-muted ring-1 ring-line">
            No SOPs for your role yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sops.map((sop) => (
              <li key={sop.id}>
                <Link
                  href={`/sops/${sop.id}`}
                  className="flex flex-col gap-0.5 rounded-xl bg-surface px-4 py-3.5 ring-1 ring-line hover:ring-accent"
                >
                  <span className="font-mono text-[11px] tracking-wide text-accent">{sop.id}</span>
                  <span className="font-semibold">{sop.title}</span>
                  <span className="text-sm text-muted">
                    Rev {sop.revision}
                    {sop.department && ` · ${sop.department.name}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
