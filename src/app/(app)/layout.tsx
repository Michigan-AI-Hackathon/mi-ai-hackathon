import Link from "next/link";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";
import NavProgress from "@/components/NavProgress";
import AppNav from "@/components/AppNav";
import HelpButton from "@/components/HelpButton";
import { devScenario } from "@/lib/dev-preview";
import { requireStudent } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireStudent();
  const [{ data: convs }, { count: invites }, { data: membership }] = await Promise.all([
    supabase.rpc("my_conversations"),
    supabase.from("invites").select("id", { count: "exact", head: true })
      .eq("status", "pending").eq("kind", "invite").eq("student_id", profile.id).gt("expires_at", new Date().toISOString()),
    supabase.from("team_members").select("team_id").eq("user_id", profile.id).maybeSingle(),
  ]);
  const dev = await devScenario();
  const unread = ((convs ?? []) as { unread: number }[]).reduce((n, c) => n + c.unread, 0);

  return (
    <div className="min-h-dvh">
      <NavProgress />
      {dev && (
        <div className="bg-ink text-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 text-[13px] sm:px-6">
            <span className="font-semibold">Dev preview · fake data, actions are off</span>
            {([["admin", "Organizer"], ["new", "New signup"], ["unpaid", "Not paid"], ["solo", "Paid, no team"], ["team", "On a team"]] as const).map(([k, l]) => (
              <a key={k} href={`/dev/preview?as=${k}`} className={`link-draw ${dev === k ? "font-semibold text-accent" : "text-card/70 hover:text-card"}`}>{l}</a>
            ))}
            <a href="/dev/exit" className="ml-auto text-card/70 hover:text-card">Exit preview</a>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-line bg-card/95 md:bg-card/85 md:backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-3 text-sm">
            {profile.is_admin && <Link href="/admin" className="inline-flex min-h-9 items-center rounded-full bg-ink px-4 text-sm font-semibold text-card">Organizer dashboard</Link>}
            <Link href="/onboarding" className="flex min-h-11 min-w-11 items-center gap-2 text-muted hover:text-ink"><Avatar url={profile.avatar_url} name={profile.full_name} size={28} /><span className="link-draw hidden sm:inline">{profile.full_name}</span></Link>
            <form action="/auth/signout" method="post"><button className="link-draw min-h-11 text-muted hover:text-ink">Sign out</button></form>
          </div>
        </div>
        <AppNav invites={invites ?? 0} unread={unread} teamId={membership?.team_id ?? null} />
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:py-10">{children}</main>
      <HelpButton />
    </div>
  );
}
