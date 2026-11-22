"use client";

import { useState } from "react";
import Spinner from "@/components/Spinner";

// Sign out, with a full-screen "Signing out…" while the site logs you out.
export default function SignOutButton() {
  const [leaving, setLeaving] = useState(false);
  return (
    <form action="/auth/signout" method="post" className="ml-1.5" onSubmit={() => setLeaving(true)}>
      <button type="submit" disabled={leaving} className="text-[#d6d2ce] underline hover:text-white">
        Sign out
      </button>
      {leaving && <LoadingScreen label="Signing out…" />}
    </form>
  );
}

// Full-screen "please wait". It stays invisible for the first 1.5 seconds, so
// quick sign-ins and sign-outs never flash it; it only appears when it's slow.
export function LoadingScreen({ label }: { label: string }) {
  return (
    <div role="status" className="slow-show fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/90 text-foreground backdrop-blur-sm">
      <Spinner className="size-10 text-accent" />
      <p className="font-display text-lg font-semibold">{label}</p>
    </div>
  );
}
