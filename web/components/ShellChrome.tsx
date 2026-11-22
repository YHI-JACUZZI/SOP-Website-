"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import Logo from "@/components/Logo";
import { LoadingScreen } from "@/components/SignOutButton";
import ThemeToggle from "@/components/ThemeToggle";
import type { MyProgress } from "@/lib/progress";

type Person = { name: string; email: string; role: string | null; isAdmin: boolean; isManager: boolean };
type Item = { href: string; label: string; icon: IconName; match?: string[]; badge?: number; alert?: boolean };

// Pages that count as part of "Dashboard" in the side menu.
const DASHBOARD = ["/", "/certificates", "/search"];

function isActive(path: string, item: Item) {
  return (item.match ?? [item.href]).some((m) => (m === "/" ? path === "/" : path === m || path.startsWith(`${m}/`)));
}

function SidebarBody({ groups, path, progress, pct }: { groups: { title: string; items: Item[] }[]; path: string; progress: MyProgress; pct: number }) {
  return (
  <div className="relative flex h-full flex-col gap-6 overflow-y-auto px-3.5 py-5"
    onScroll={(e) => { if (e.currentTarget.offsetHeight) lastScroll = e.currentTarget.scrollTop; }}>
    <SlidingPill path={path} />
    <Link href="/" className="flex flex-col gap-1.5 rounded-lg px-2 py-1">
      <Logo className="w-40" />
      <span className="font-display text-[13px] font-extrabold tracking-[0.12em] text-muted">SOP HUB</span>
    </Link>

    {groups.map((g) => (
      <nav key={g.title} aria-label={g.title} className="flex flex-col gap-0.5">
        <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{g.title}</p>
        {g.items.map((item) => {
          const active = isActive(path, item);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-1.5 text-[15px] ${
                active ? "font-bold text-foreground" : "text-nav-text hover:bg-nav-hover hover:text-foreground"
              }`}>
              <span data-nav-icon className={`relative -mx-[7px] flex size-8 shrink-0 items-center justify-center ${active ? "text-white" : ""}`}>
                <Icon name={item.icon} />
              </span>
              <span className="flex-1">{item.label}</span>
              {!!item.badge && (
                <span className={`min-w-6 rounded-full px-1.5 py-px text-center text-xs font-semibold ${
                  item.alert ? "bg-danger text-white" : "bg-chip text-foreground"}`}
                  aria-label={`${item.badge} to finish`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    ))}

    {progress.total > 0 && (
      <Link href="/" className="mt-auto flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 hover:border-accent">
        <span className="ring-fill relative flex size-12 shrink-0 items-center justify-center rounded-full"
          style={{ "--pct": pct, background: "conic-gradient(var(--brand) calc(var(--pct) * 1%), var(--track) 0)" } as React.CSSProperties}>
          <span className="flex size-[38px] items-center justify-center rounded-full bg-surface text-xs font-bold">{pct}%</span>
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold">Training progress</span>
          <span className="text-xs text-muted">{progress.done} of {progress.total} SOPs done</span>
        </span>
      </Link>
    )}
  </div>
);
}

// Where the orange highlight sat on the last page, so it can slide from there
// to the new page's menu item instead of just appearing.
let lastPill: { top: number; left: number } | null = null;
// How far the menu was scrolled, so it stays put when the next page opens.
let lastScroll = 0;

// The glowing square behind the current menu item's icon. It glides to the new
// item whenever you move to another page.
function SlidingPill({ path }: { path: string }) {
  const [pos, setPos] = useState(lastPill);
  const me = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const list = me.current?.parentElement;
    const el = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (list && list.offsetHeight) {
      // Keep the menu scrolled where it was, and make sure the current page shows.
      list.scrollTop = lastScroll;
      if (el && (el.offsetTop < list.scrollTop || el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight))
        list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2;
      lastScroll = list.scrollTop;
    }
    if (!el) { setPos(null); return; }
    if (!el.offsetHeight) return; // this copy of the menu is hidden (phone vs. desktop)
    const icon = el.querySelector<HTMLElement>("[data-nav-icon]");
    if (!icon) return;
    const next = { top: el.offsetTop + icon.offsetTop, left: el.offsetLeft + icon.offsetLeft };
    if (lastPill && (lastPill.top !== next.top || lastPill.left !== next.left)) {
      setPos(lastPill);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setPos(next)));
      lastPill = next;
      return () => cancelAnimationFrame(raf);
    }
    setPos(next);
    lastPill = next;
  }, [path]);
  return (
    <span ref={me} aria-hidden hidden={!pos} className="pill-slide pointer-events-none absolute left-0 top-0 size-8 rounded-[10px] bg-[image:var(--glow)] shadow-[var(--glow-shadow)]"
      style={pos ? { transform: `translate(${pos.left}px, ${pos.top}px)` } : undefined} />
  );
}

export function initials(name: string) {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function ShellChrome({ person, progress }: { person: Person; progress: MyProgress }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // Close the phone menu after moving to another page.
  useEffect(() => setOpen(false), [path]);

  // While the next page loads, show a thin orange bar along the top instead of
  // a full loading screen. The current page stays on screen until then.
  const [going, setGoing] = useState(false);
  useEffect(() => setGoing(false), [path]);
  useEffect(() => {
    if (!going) return;
    const t = setTimeout(() => setGoing(false), 15000);
    return () => clearTimeout(t);
  }, [going]);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin === location.origin && url.pathname !== location.pathname) setGoing(true);
    };
    const submit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement;
      if (!e.defaultPrevented && f.method !== "post" && new URL(f.action).pathname !== location.pathname) setGoing(true);
    };
    document.addEventListener("click", click);
    document.addEventListener("submit", submit);
    return () => { document.removeEventListener("click", click); document.removeEventListener("submit", submit); };
  }, []);

  const groups: { title: string; items: Item[] }[] = [
    {
      title: "My work",
      items: [
        { href: "/", label: "Dashboard", icon: "home", match: DASHBOARD, badge: progress.open, alert: progress.overdue > 0 },
        { href: "/sops", label: "My SOPs", icon: "doc" },
        { href: "/onboarding", label: "Onboarding", icon: "check" },
        { href: "/dept", label: "My department", icon: "team" },
      ],
    },
    {
      title: "Company",
      items: [
        { href: "/map", label: "Company map", icon: "map" },
        { href: "/handbook", label: "Employee handbook", icon: "book" },
        { href: "/policies", label: "Policies", icon: "shield" },
        { href: "/people", label: "People", icon: "people" },
        { href: "/org", label: "Org chart", icon: "org" },
      ],
    },
  ];
  if (person.isAdmin || person.isManager) {
    groups.push({
      title: "Manage",
      items: [
        { href: "/team", label: "Team progress", icon: "chart" },
        ...(person.isAdmin
          ? ([
              { href: "/admin/import", label: "Import SOP", icon: "upload" },
              { href: "/admin/people", label: "Manage people", icon: "userPlus" },
            ] satisfies Item[])
          : []),
      ],
    });
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <>
      {going && (
        <div role="progressbar" aria-label="Loading page" className="fixed inset-x-0 top-0 z-[60] h-[3px] print:hidden">
          <div className="nav-progress h-full origin-left scale-x-90 bg-[image:var(--glow)] shadow-[var(--glow-shadow)]" />
        </div>
      )}
      {/* Side menu: always showing on wide screens, slides in on phones. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-sidebar lg:block print:hidden"><SidebarBody groups={groups} path={path} progress={progress} pct={pct} /></aside>
      <div className={`fade fixed inset-0 z-40 bg-black/40 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setOpen(false)} aria-hidden />
      <aside aria-label="Menu" className={`drawer fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-line bg-sidebar shadow-xl lg:hidden print:hidden ${
        open ? "translate-x-0" : "-translate-x-full"}`} inert={!open}>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close menu"
          className="absolute right-3 top-4 flex size-10 items-center justify-center rounded-xl text-muted hover:bg-nav-hover">
          <Icon name="close" />
        </button>
        <SidebarBody groups={groups} path={path} progress={progress} pct={pct} />
      </aside>

      <header className="sticky top-0 z-20 flex h-[4.25rem] items-center gap-3 border-b border-line bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-8 print:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}
          className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface lg:hidden">
          <Icon name="menu" />
        </button>
        <form action="/search" role="search" className="flex h-10 min-w-0 max-w-md flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-muted focus-within:border-accent">
          <Icon name="search" />
          <label htmlFor="top-q" className="sr-only">Search SOPs, policies, the handbook and people</label>
          <input id="top-q" name="q" type="search" placeholder="Search SOPs, policies, people…"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted" />
        </form>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <AccountMenu person={person} />
        </div>
      </header>
    </>
  );
}

function AccountMenu({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Close when clicking anywhere else or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu"
        className="flex h-11 items-center gap-2.5 rounded-full border border-line bg-surface py-1 pl-1 pr-2 hover:border-accent sm:pr-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white">{initials(person.name)}</span>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="max-w-40 truncate text-sm font-semibold">{person.name}</span>
          {person.role && <span className="text-xs text-muted">{person.role}</span>}
        </span>
        <Icon name="chevronDown" className="size-3.5 text-muted" />
      </button>
      {open && (
        <div role="menu" className="pop absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate font-semibold">{person.name}</p>
            <p className="truncate text-sm text-muted">{person.email}</p>
          </div>
          <div className="flex flex-col p-1.5">
            <Link role="menuitem" href="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-nav-hover"><Icon name="home" />My dashboard</Link>
            <Link role="menuitem" href="/people" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-nav-hover"><Icon name="people" />People</Link>
            <form action="/auth/signout" method="post" onSubmit={() => setLeaving(true)}>
              <button role="menuitem" type="submit" disabled={leaving}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-danger hover:bg-danger-bg">
                <Icon name="signOut" />Sign out
              </button>
            </form>
          </div>
        </div>
      )}
      {leaving && <LoadingScreen label="Signing out…" />}
    </div>
  );
}
