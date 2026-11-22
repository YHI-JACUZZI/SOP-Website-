import Link from "next/link";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="page-enter mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-6 py-16">
      <Logo className="mb-4 w-36" />
      <h1 className="font-display text-3xl font-extrabold">Page not found</h1>
      <p className="text-muted">It may not exist, or it isn&apos;t part of your role.</p>
      <Link href="/" className="inline-flex h-11 items-center self-start rounded-xl bg-btn px-5 font-semibold text-white hover:bg-btn-hover">
        Back to My dashboard
      </Link>
    </main>
  );
}
