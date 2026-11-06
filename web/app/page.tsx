import TopBar from "@/components/TopBar";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm text-[#d6d2ce] underline hover:text-white">
            Sign out
          </button>
        </form>
      </TopBar>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-6 py-12">
        <h1 className="font-display text-3xl font-bold">My SOPs</h1>
        <p className="text-muted">
          Signed in as <span className="font-semibold text-foreground">{user?.email}</span>
        </p>
        <p className="rounded-lg bg-surface p-4 text-sm text-muted ring-1 ring-line">
          Your SOPs will show up here once roles are set up (Phase 3 of the build plan).
        </p>
      </main>
    </div>
  );
}
