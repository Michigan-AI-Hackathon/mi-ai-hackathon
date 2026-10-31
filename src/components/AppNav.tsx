"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import NavLink from "@/components/NavLink";
import { createClient } from "@/lib/supabase/client";

// The student nav with LIVE badges. A layout doesn't re-render when you move between pages, so counts computed on the
// server go stale (that is why messages kept showing as unread). This re-reads them when the page changes, when a
// conversation is opened, and whenever a new message arrives.
export default function AppNav({ invites, unread }: { invites: number; unread: number }) {
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

  return (
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4" aria-label="Main">
      <NavLink href="/dashboard">Home</NavLink>
      <NavLink href="/people">Find teammates</NavLink>
      <NavLink href="/teams">Open teams</NavLink>
      <NavLink href="/team">My team</NavLink>
      <NavLink href="/invites" badge={c.invites}>Invites</NavLink>
      <NavLink href="/messages" badge={c.unread}>Messages</NavLink>
    </nav>
  );
}
