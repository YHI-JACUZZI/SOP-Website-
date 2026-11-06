import SignedInBar from "@/components/SignedInBar";
import { getMyProfile } from "@/lib/profile";

export default async function Home() {
  const profile = await getMyProfile();
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
        <p className="rounded-lg bg-surface p-4 text-sm text-muted ring-1 ring-line">
          Your SOPs will show up here once they move into the site (Phase 4 of
          the build plan).
        </p>
      </main>
    </div>
  );
}
