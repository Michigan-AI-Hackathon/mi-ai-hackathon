"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NavLink from "@/components/NavLink";
import { createClient } from "@/lib/supabase/client";

// The student nav with LIVE badges. A layout doesn't re-render when you move between pages, so counts computed on the
// server go stale (that is why messages kept showing as unread). This re-reads them when the page changes, when a
// conversation is opened, and whenever a new message arrives.
export default function AppNav({ invites, unread, teamId = null }: { invites: number; unread: number; teamId?: string | null }) {
  const path = usePathname();
  const [c, setC] = useState({ invites, unread });

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: convs, error: e1 }, { count, error: e2 }] = await Promise.all([
        supabase.rpc("my_conversations"),
        supabase.from("invites").select("id", { count: "exact", head: true })
          .eq("status", "pending").eq("kind", "invite").eq("student_id", user.id).gt("expires_at", new Date().toISOString()),
      ]);
      if (e1 || e2) return; // keep the server's numbers if we can't read
      setC({ unread: ((convs ?? []) as { unread: number }[]).reduce((n, x) => n + x.unread, 0), invites: count ?? 0 });
    } catch { /* keep the server's numbers */ }
  }, []);

  useEffect(() => { refresh(); }, [path, refresh]);
  useEffect(() => {
    window.addEventListener("unread-changed", refresh);
    const supabase = createClient();
    const channel = supabase.channel("nav-messages").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => refresh()).subscribe();
    return () => { window.removeEventListener("unread-changed", refresh); supabase.removeChannel(channel); };
  }, [refresh]);

  const onTeam = !!teamId;
  const teamHref = onTeam ? "/team" : "/teams";
  const teamLabel = onTeam ? "My Team" : "Teams";
  const teamAlso = onTeam ? [`/teams/${teamId}`] : ["/team"];
  const tabs = [
    { href: "/dashboard", label: "Home", d: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z", also: [] as string[], badge: 0 },
    { href: teamHref, label: teamLabel, d: "M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0", also: teamAlso, badge: 0 },
    { href: "/people", label: "People", d: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5", also: [], badge: 0 },
    { href: "/invites", label: "Invites", d: "M3 6h18v12H3zM3 7l9 7 9-7", also: [], badge: c.invites },
    { href: "/messages", label: "Messages", d: "M4 5h16v11H9l-5 4z", also: [], badge: c.unread },
  ];
  return (
    <>
      <nav className="mx-auto hidden max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4 md:flex" aria-label="Main">
        <NavLink href="/dashboard">Home</NavLink>
        <NavLink href={teamHref} also={teamAlso}>{teamLabel}</NavLink>
        <NavLink href="/people">Find teammates</NavLink>
        <NavLink href="/invites" badge={c.invites}>Invites</NavLink>
        <NavLink href="/messages" badge={c.unread}>Messages</NavLink>
      </nav>
      {/* Phone: bottom tab bar, thumb reachable, with badges */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur-md md:hidden" aria-label="Main">
        <ul className="grid grid-cols-5">
          {tabs.map((t) => {
            const active = [t.href, ...t.also].some((h) => path === h || path.startsWith(h + "/"));
            return (
              <li key={t.href}>
                <Link href={t.href} aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? "text-ink" : "text-muted"}`}>
                  <span className="relative">
                    <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d={t.d} /></svg>
                    {t.badge > 0 && <span className="absolute -right-2.5 -top-1.5 rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-hero">{t.badge}<span className="sr-only"> new</span></span>}
                  </span>
                  {t.label}
                  {active && <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-accent" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
