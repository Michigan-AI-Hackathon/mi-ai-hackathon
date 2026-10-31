import Link from "next/link";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";
import NavLink from "@/components/NavLink";
import { devScenario } from "@/lib/dev-preview";
import { requireStudent } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireStudent();
  const [{ data: convs }, { count: invites }] = await Promise.all([
    supabase.rpc("my_conversations"),
    supabase.from("invites").select("id", { count: "exact", head: true })
      .eq("status", "pending").eq("kind", "invite").eq("student_id", profile.id).gt("expires_at", new Date().toISOString()),
  ]);
  const dev = await devScenario();
  const unread = ((convs ?? []) as { unread: number }[]).reduce((n, c) => n + c.unread, 0);

  return (
    <div className="min-h-screen">
      {dev && (
        <div className="bg-ink text-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 text-[13px] sm:px-6">
            <span className="font-semibold">Dev preview · fake data, actions are off</span>
            {([["new", "New signup"], ["unpaid", "Not paid"], ["solo", "Paid, no team"], ["team", "On a team"]] as const).map(([k, l]) => (
              <a key={k} href={`/dev/preview?as=${k}`} className={`link-draw ${dev === k ? "font-semibold text-accent" : "text-card/70 hover:text-card"}`}>{l}</a>
            ))}
            <a href="/dev/exit" className="ml-auto text-card/70 hover:text-card">Exit preview</a>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-line bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-3 text-sm">
            <Link href="/onboarding" className="flex items-center gap-2 text-muted hover:text-ink"><Avatar url={profile.avatar_url} name={profile.full_name} size={28} /><span className="link-draw hidden sm:inline">{profile.full_name}</span></Link>
            <form action="/auth/signout" method="post"><button className="link-draw text-muted hover:text-ink">Sign out</button></form>
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
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
