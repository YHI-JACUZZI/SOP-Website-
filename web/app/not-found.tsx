import Link from "next/link";
import TopBar from "@/components/TopBar";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 py-16">
        <h1 className="font-display text-2xl font-bold">Page not found</h1>
        <p className="text-muted">
          It may not exist, or it isn&apos;t part of your role.
        </p>
        <Link href="/" className="font-medium text-accent">
          Back to My dashboard
        </Link>
      </main>
    </div>
  );
}
