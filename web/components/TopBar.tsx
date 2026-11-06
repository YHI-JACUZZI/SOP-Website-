// Black bar with the orange rule, matching the test site and SOP template.
export default function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-b-4 border-brand-rule bg-bar text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-rule">
            Yancey Home Improvements
          </p>
          <p className="font-display text-2xl font-extrabold">SOP Hub</p>
        </div>
        {children}
      </div>
    </header>
  );
}
