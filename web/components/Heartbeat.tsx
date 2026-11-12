"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// While the page is open and in view, tell the site every 2 minutes that
// this person is still here, so reading a long SOP still counts as online.
export default function Heartbeat() {
  useEffect(() => {
    const supabase = createClient();
    const beat = () => { if (document.visibilityState === "visible") void supabase.rpc("touch_last_seen"); };
    const t = setInterval(beat, 120_000);
    document.addEventListener("visibilitychange", beat);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", beat); };
  }, []);
  return null;
}
