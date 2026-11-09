"use client";

import { useFormStatus } from "react-dom";
import Spinner from "@/components/Spinner";

// Submit button that spins and locks while its form is being sent.
export default function PendingButton({ children, pendingLabel, className }: { children: React.ReactNode; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`inline-flex items-center justify-center gap-2.5 disabled:cursor-wait disabled:opacity-80 ${className}`}>
      {pending && <Spinner />}
      {pending ? pendingLabel : children}
    </button>
  );
}
