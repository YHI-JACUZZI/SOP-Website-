export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-4 border-brand-rule bg-bar px-6 py-4 text-white">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-rule">
          Yancey Home Improvements
        </p>
        <h1 className="font-display text-2xl font-extrabold">SOP Hub</h1>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-6 py-16">
        <h2 className="font-display text-3xl font-bold">Hello from the real build</h2>
        <p className="text-lg text-muted">
          This is the starter site. Sign-in, role-based SOPs and the company
          map get added here one phase at a time.
        </p>
        <p className="rounded-lg bg-surface p-4 text-sm text-muted ring-1 ring-line">
          Phase 1 of the build plan: starter site live.
        </p>
      </main>
    </div>
  );
}
