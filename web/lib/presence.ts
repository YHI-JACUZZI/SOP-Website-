// "Online now" means active on the site in the last 5 minutes.
export const ONLINE_MINUTES = 5;

export type Presence = { online: boolean; label: string };

export function presence(lastSeen: string | null | undefined, now = Date.now()): Presence {
  if (!lastSeen) return { online: false, label: "Not seen yet" };
  const mins = Math.floor((now - new Date(lastSeen).getTime()) / 60000);
  if (mins < ONLINE_MINUTES) return { online: true, label: "Online now" };
  if (mins < 60) return { online: false, label: `Active ${mins} min ago` };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { online: false, label: `Active ${hrs} hr${hrs === 1 ? "" : "s"} ago` };
  const days = Math.floor(hrs / 24);
  if (days < 30) return { online: false, label: days === 1 ? "Active yesterday" : `Active ${days} days ago` };
  return { online: false, label: `Active ${new Date(lastSeen).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` };
}
