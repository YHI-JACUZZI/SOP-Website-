"use client";

import { usePathname } from "next/navigation";

// Replays a short fade-up each time you move to another page or tab.
export default function PageFade({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div key={path} className="page-enter flex min-h-[calc(100vh-4.25rem)] flex-col print:min-h-0">
      {children}
    </div>
  );
}
