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
    <AuthCard title="Sign in" error={error} notice={notice}>
      <form action={signIn} className="flex flex-col gap-5">
        <Field id="email" label="Work email" type="email" autoComplete="email" />
        <Field id="password" label="Password" type="password" autoComplete="current-password" />
        <SubmitButton>Sign in</SubmitButton>
      </form>
      <Link href="/forgot-password" className="self-center font-medium text-accent">
        Forgot password?
      </Link>
      <p className="mt-auto rounded-lg bg-[#fdeee2] p-4 text-sm text-[#3a2312]">
        New here? Your manager sends you an email invite. Open it to set your
        password, then sign in.
      </p>
    </AuthCard>
  );
}
