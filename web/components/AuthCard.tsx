import TopBar from "@/components/TopBar";

// Shared frame for the sign-in, forgot-password and set-password screens.
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
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-6 py-12">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {intro && <p className="text-muted">{intro}</p>}
        {error && (
          <p role="alert" className="rounded-lg bg-[#fbe4de] p-3 text-sm text-[#a3290f]">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-lg bg-[#e1f4e8] p-3 text-sm text-[#12663a]">
            {notice}
          </p>
        )}
        {children}
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
        className="text-[13px] font-semibold uppercase tracking-wide text-muted"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        className="h-12 rounded-lg border border-line bg-surface px-3.5 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    </div>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="h-12 rounded-lg bg-[#c25508] text-base font-semibold text-white hover:bg-[#a84a07]"
    >
      {children}
    </button>
  );
}
