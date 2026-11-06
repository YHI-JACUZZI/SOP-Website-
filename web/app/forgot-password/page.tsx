import Link from "next/link";
import AuthCard, { Field, SubmitButton } from "@/components/AuthCard";
import { sendReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;

  return (
    <AuthCard
      title="Reset your password"
      intro="Enter your work email and we'll send you a link to set a new password."
      notice={notice}
    >
      <form action={sendReset} className="flex flex-col gap-5">
        <Field id="email" label="Work email" type="email" autoComplete="email" />
        <SubmitButton>Send reset link</SubmitButton>
      </form>
      <Link href="/login" className="self-center font-medium text-accent">
        Back to sign in
      </Link>
    </AuthCard>
  );
}
