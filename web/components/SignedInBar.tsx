import Heartbeat from "@/components/Heartbeat";
import NavLink from "@/components/NavLink";
import SignOutButton from "@/components/SignOutButton";
import TopBar from "@/components/TopBar";
import type { Profile } from "@/lib/profile";

// Every dashboard section (and the documents opened from it) keeps "My dashboard" lit.
const DASHBOARD = ["/", "/dept", "/handbook", "/people", "/policies", "/search", "/onboarding", "/org", "/sops", "/certificates"];

// Top bar for signed-in pages: role tag, admin links and sign out.
export default function SignedInBar({ profile }: { profile: Profile | null }) {
  return (
    <TopBar>
      <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm">
        {profile?.role && (
          <span className="mr-2 rounded border border-brand-rule px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-brand-rule">
            {profile.role.name}
          </span>
        )}
        <NavLink href="/" match={DASHBOARD}>My dashboard</NavLink>
        <NavLink href="/map">Company map</NavLink>
        {(profile?.role?.is_admin || profile?.role?.is_manager) && (
          <NavLink href="/team">Team progress</NavLink>
        )}
        {profile?.role?.is_admin && (
          <>
            <NavLink href="/admin/import">Import SOP</NavLink>
            <NavLink href="/admin/people">Manage people</NavLink>
          </>
        )}
        <SignOutButton />
        {profile && <Heartbeat />}
      </nav>
    </TopBar>
  );
}
