import AuthCard, { Field, SubmitButton } from "@/components/AuthCard";
import { updatePassword } from "./actions";

// Reached from an invite or a reset email, after /auth/confirm signs the person in.
export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  const { error, reason } = await searchParams;

  return (
    <AuthCard
      title="Set your password"
      intro={reason === "temp"
        ? "You signed in with a temporary password. Choose your own to carry on (at least 8 characters)."
        : "Choose a password with at least 8 characters."}
      error={error}
    >
      <form action={updatePassword} className="flex flex-col gap-5">
        <Field id="password" label="New password" type="password" autoComplete="new-password" />
        <Field id="confirm" label="Type it again" type="password" autoComplete="new-password" />
        <SubmitButton pendingLabel="Saving…">Save password</SubmitButton>
      </form>
    </AuthCard>
  );
}
