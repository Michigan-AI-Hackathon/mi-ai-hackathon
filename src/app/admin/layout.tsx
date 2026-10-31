import Link from "next/link";
import Logo from "@/components/Logo";
import NavLink from "@/components/NavLink";
import { requireAdmin } from "@/lib/admin";
import { devScenario } from "@/lib/dev-preview";

export const metadata = { title: "Organizer · Michigan AI Hackathon", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();
  const dev = await devScenario();
  return (
    <div className="min-h-screen">
      {dev && (
        <div className="bg-ink text-card print:hidden"><div className="mx-auto flex max-w-7xl gap-5 px-4 py-2 text-[13px] sm:px-6">
          <span className="font-semibold">Dev preview · fake data, actions are off</span>
          <a href="/dev/exit" className="ml-auto text-card/70 hover:text-card">Exit preview</a>
        </div></div>
      )}
      <header className="border-b border-line bg-card print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo href="/admin" />
            <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-card">Organizer</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted">
            <Link href="/dashboard" className="link-draw hover:text-ink">Student view</Link>
            <span className="hidden sm:inline">{profile.full_name ?? profile.email}</span>
            <form action="/auth/signout" method="post"><button className="link-draw hover:text-ink">Sign out</button></form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 sm:px-4" aria-label="Organizer">
          <NavLink href="/admin/overview">Overview</NavLink>
          <NavLink href="/admin/students">Students</NavLink>
          <NavLink href="/admin/teams">Teams</NavLink>
          <NavLink href="/admin/events">Events</NavLink>
          <NavLink href="/admin/day-of">Day of</NavLink>
          <NavLink href="/admin/broadcast">Announce</NavLink>
          <NavLink href="/admin/audit">Audit log</NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
