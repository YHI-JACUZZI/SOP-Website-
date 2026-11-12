import { presence } from "@/lib/presence";

// Green dot for "Online now", grey otherwise, with when they were last active.
export default function PresenceBadge({ lastSeen }: { lastSeen: string | null | undefined }) {
  const p = presence(lastSeen);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${p.online ? "font-semibold text-[#12663a]" : "text-muted"}`}>
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${p.online ? "bg-[#1f9d55]" : "bg-line"}`} />
      {p.label}
    </span>
  );
}
