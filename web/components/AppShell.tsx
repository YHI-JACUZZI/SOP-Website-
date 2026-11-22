import ShellChrome from "@/components/ShellChrome";
import PageFade from "@/components/PageFade";
import type { Profile } from "@/lib/profile";
import { getMyProgress } from "@/lib/progress";

// The frame around every signed-in page: side menu, top bar (search, light/dark
// switch, account menu) and the page itself, which fades in gently.
export default async function AppShell({ profile, children }: { profile: Profile | null; children: React.ReactNode }) {
  const progress = await getMyProgress(profile);
  return (
    <div className="min-h-screen lg:pl-64 print:pl-0">
      <ShellChrome
        person={{
          name: profile?.full_name || profile?.email || "",
          email: profile?.email ?? "",
          role: profile?.role?.name ?? null,
          isAdmin: !!profile?.role?.is_admin,
          isManager: !!profile?.role?.is_manager,
        }}
        progress={progress}
      />
      <PageFade>{children}</PageFade>
    </div>
  );
}
