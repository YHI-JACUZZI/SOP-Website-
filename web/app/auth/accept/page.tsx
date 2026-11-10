import AuthCard, { SubmitButton } from "@/components/AuthCard";

// Step between a sign-in link and signing in: one click to continue.
export default async function AcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash = "", type = "", next = "/update-password" } = await searchParams;
  const invite = type === "invite";

  return (
    <AuthCard
      title={invite ? "Welcome to the SOP Hub" : "Reset your password"}
      intro={invite ? "You've been given an account. Continue to choose your password." : "Continue to choose a new password."}
      error={token_hash ? undefined : "This link is missing a part. Ask your manager for a new one."}
    >
      {token_hash && (
        <form action="/auth/confirm" method="post" className="flex flex-col gap-5">
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />
          <SubmitButton pendingLabel="One moment…">Continue</SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}
