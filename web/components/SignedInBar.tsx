import Link from "next/link";
import TopBar from "@/components/TopBar";
import type { Profile } from "@/lib/profile";

// Top bar for signed-in pages: role tag, admin links and sign out.
export default function SignedInBar({ profile }: { profile: Profile | null }) {
  return (
    <TopBar>
      <nav className="flex flex-wrap items-center gap-4 text-sm">
        {profile?.role && (
          <span className="rounded bg-brand-rule px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-bar">
            {profile.role.name}
          </span>
        )}
        <Link href="/" className="text-[#d6d2ce] hover:text-white">
          My SOPs
        </Link>
        {profile?.role?.is_admin && (
          <>
            <Link href="/admin/import" className="text-[#d6d2ce] hover:text-white">
              Import SOP
            </Link>
            <Link href="/admin/people" className="text-[#d6d2ce] hover:text-white">
              People
            </Link>
          </>
        )}
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-[#d6d2ce] underline hover:text-white">
            Sign out
          </button>
        </form>
      </nav>
    </TopBar>
  );
}
