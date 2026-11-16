import Link from "next/link";
import Logo from "@/components/Logo";
import NavProgress from "@/components/NavProgress";
import AdminNav from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin";
import { devScenario } from "@/lib/dev-preview";

export const metadata = { title: "Organizer · Michigan AI Hackathon", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();
  const dev = await devScenario();
  return (
    <div className="min-h-dvh">
      <NavProgress />
      {dev && (
        <div className="bg-ink text-card print:hidden"><div className="mx-auto flex max-w-7xl gap-5 px-4 py-2 text-[13px] sm:px-6">
          <span className="font-semibold">Dev preview · fake data, actions are off</span>
          <a href="/dev/exit" className="ml-auto inline-flex min-h-8 items-center text-card/70 hover:text-card">Exit preview</a>
        </div></div>
      )}
      <header className="border-b border-line bg-card print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo href="/admin" />
            <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-card">Organizer</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted">
            <Link href="/dashboard" className="link-draw inline-flex min-h-11 items-center hover:text-ink">Student view</Link>
            <span className="hidden sm:inline">{profile.full_name ?? profile.email}</span>
            <form action="/auth/signout" method="post"><button className="link-draw min-h-11 hover:text-ink">Sign out</button></form>
          </div>
        </div>
        <AdminNav />
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
