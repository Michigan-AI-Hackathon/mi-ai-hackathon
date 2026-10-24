import Link from "next/link";
import Logo from "@/components/Logo";
import NavLink from "@/components/NavLink";
import { requireStudent } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireStudent();
  const [{ data: convs }, { count: invites }] = await Promise.all([
    supabase.rpc("my_conversations"),
    supabase.from("invites").select("id", { count: "exact", head: true })
      .eq("status", "pending").eq("kind", "invite").eq("student_id", profile.id).gt("expires_at", new Date().toISOString()),
  ]);
  const unread = ((convs ?? []) as { unread: number }[]).reduce((n, c) => n + c.unread, 0);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-3 text-sm">
            <Link href="/onboarding" className="text-muted hover:text-ink">{profile.full_name}</Link>
            <form action="/auth/signout" method="post"><button className="text-muted hover:text-ink">Sign out</button></form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4" aria-label="Main">
          <NavLink href="/dashboard">Home</NavLink>
          <NavLink href="/people">Find teammates</NavLink>
          <NavLink href="/teams">Open teams</NavLink>
          <NavLink href="/team">My team</NavLink>
          <NavLink href="/invites" badge={invites ?? 0}>Invites</NavLink>
          <NavLink href="/messages" badge={unread}>Messages</NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
