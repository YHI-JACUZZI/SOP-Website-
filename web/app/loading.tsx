import Spinner from "@/components/Spinner";

// Shown while a page loads (for example, the dashboard right after signing in).
export default function Loading() {
  return (
    <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Spinner className="size-10 text-accent" />
      <p className="font-display text-lg font-semibold">Loading…</p>
    </div>
  );
}
