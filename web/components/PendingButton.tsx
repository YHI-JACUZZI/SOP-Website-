"use client";

import { useFormStatus } from "react-dom";
import { LoadingScreen } from "@/components/SignOutButton";
import Spinner from "@/components/Spinner";

// Submit button that spins and locks while its form is being sent.
// With slowScreen, a full-screen "please wait" also appears if it takes more than 1.5 seconds.
export default function PendingButton({ children, pendingLabel, className, slowScreen }: { children: React.ReactNode; pendingLabel: string; className: string; slowScreen?: string }) {
  const { pending } = useFormStatus();
  return (
    <>
    {pending && slowScreen && <LoadingScreen label={slowScreen} />}
    <button type="submit" disabled={pending} aria-busy={pending} className={`inline-flex items-center justify-center gap-2.5 disabled:cursor-wait disabled:opacity-80 ${className}`}>
      {pending && <Spinner />}
      {pending ? pendingLabel : children}
    </button>
    </>
  );
}
