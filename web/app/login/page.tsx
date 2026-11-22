import Link from "next/link";
import AuthCard, { Field, SubmitButton } from "@/components/AuthCard";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;

  return (
    <AuthCard title="Sign in" intro="Welcome back. Use your work email." error={error} notice={notice}>
      <form action={signIn} className="flex flex-col gap-5">
        <Field id="email" label="Work email" type="email" autoComplete="email" />
        <Field id="password" label="Password" type="password" autoComplete="current-password" />
        <SubmitButton pendingLabel="Signing in…" slowScreen="Signing you in…">Sign in</SubmitButton>
      </form>
      <Link href="/forgot-password" className="self-center font-semibold text-accent hover:underline">
        Forgot password?
      </Link>
      <p className="border-t border-line pt-4 text-sm leading-relaxed text-muted">
        New here? Your manager sends you a sign-in link. Open it to set your
        password, then sign in.
      </p>
    </AuthCard>
  );
}
