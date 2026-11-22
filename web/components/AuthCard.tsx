import Logo from "@/components/Logo";
import PendingButton from "@/components/PendingButton";

// Shared frame for the sign-in, forgot-password and set-password screens:
// a dark brand panel beside the form (stacked on phones).
export default function AuthCard({
  title,
  intro,
  error,
  notice,
  children,
}: {
  title: string;
  intro?: string;
  error?: string;
  notice?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <section className="flex flex-col gap-6 border-b-4 border-brand bg-[#121110] px-6 py-8 text-white sm:px-10 lg:w-[46%] lg:border-b-0 lg:border-r-4 lg:px-14 lg:py-12">
        <div className="flex flex-col gap-2">
          <Logo dark className="w-36 lg:w-44" />
          <span className="font-display text-[13px] font-extrabold tracking-[0.14em] text-[#b0a9a2]">SOP HUB</span>
        </div>
        <div className="hidden max-w-md flex-col gap-4 lg:mt-auto lg:flex">
          <h2 className="font-display text-4xl font-extrabold leading-tight tracking-tight">Every job, done the Yancey way.</h2>
          <p className="text-lg leading-relaxed text-[#cfc9c3]">
            Your SOPs, training and company map in one place, showing only what your role needs.
          </p>
        </div>
        <ul className="hidden flex-col gap-3 text-[#e6e1dc] lg:mb-auto lg:flex">
          {["Step-by-step SOPs for your role", "Sign-offs and certificates", "See how your work fits the whole job"].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-[18px]"><path d="m5 12 5 5 9-10" /></svg>
              {t}
            </li>
          ))}
        </ul>
      </section>
      <main className="page-enter flex flex-1 items-start justify-center px-6 py-10 lg:items-center lg:py-12">
        <div className="flex w-full max-w-sm flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-3xl font-extrabold">{title}</h1>
            {intro && <p className="text-muted">{intro}</p>}
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-xl bg-ok-bg p-3 text-sm text-ok">
              {notice}
            </p>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

export function Field({
  id,
  label,
  type,
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-semibold"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        className="h-12 rounded-xl border border-line bg-surface px-3.5 text-base text-foreground outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
      />
    </div>
  );
}

export function SubmitButton({ children, pendingLabel = "One moment…", slowScreen }: { children: React.ReactNode; pendingLabel?: string; slowScreen?: string }) {
  return (
    <PendingButton pendingLabel={pendingLabel} slowScreen={slowScreen} className="h-12 rounded-xl bg-btn text-base font-semibold text-white shadow-sm hover:bg-btn-hover">
      {children}
    </PendingButton>
  );
}
