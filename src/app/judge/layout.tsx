import Link from "next/link";
import Logo from "@/components/Logo";
import NavProgress from "@/components/NavProgress";
import { requireJudge } from "@/lib/judge";

export const metadata = { title: "Judge · Michigan AI Hackathon", robots: { index: false, follow: false } };

export default async function JudgeLayout({ children }: { children: React.ReactNode }) {
  const { judge } = await requireJudge();
  return (
    <div className="min-h-dvh">
      <NavProgress />
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo href="/judge" />
            <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-card">Judge</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted">
            <Link href="/judge" className="link-draw inline-flex min-h-11 items-center hover:text-ink">My teams</Link>
            <span className="hidden sm:inline">{judge.name ?? judge.email}</span>
            <form action="/auth/signout" method="post"><button className="link-draw min-h-11 hover:text-ink">Sign out</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
