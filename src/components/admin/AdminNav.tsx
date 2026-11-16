"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// One row. The pages used every day sit in it; the ones you touch a few times live under "More".
const MAIN = [
  ["Overview", "/admin/overview"], ["Students", "/admin/students"], ["Teams", "/admin/teams"], ["Day of", "/admin/day-of"],
  ["Judging", "/admin/judging"], ["Banners", "/admin/banners"], ["Email", "/admin/broadcast"], ["Help", "/admin/help"],
] as const;
const MORE = [
  ["Matching", "/admin/matching"], ["Points", "/admin/points"], ["Sponsors", "/admin/schools"], ["Sign-up QR codes", "/admin/events"], ["Audit log", "/admin/audit"],
] as const;

const on = (path: string, href: string) => path === href || path.startsWith(href + "/");

export default function AdminNav() {
  const path = usePathname();
  const inMore = MORE.some(([, h]) => on(path, h));
  const tab = (active: boolean) => `group relative flex shrink-0 items-center px-3 py-3 text-[15px] font-medium transition-colors ${active ? "text-ink" : "text-muted hover:text-ink"}`;
  const bar = (active: boolean) => <span aria-hidden className={`absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-accent transition-transform duration-300 ${active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />;
  return (
    <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-1 px-2 sm:px-4" aria-label="Organizer">
      {MAIN.map(([l, h]) => <Link key={h} href={h} aria-current={on(path, h) ? "page" : undefined} className={tab(on(path, h))}>{l}{bar(on(path, h))}</Link>)}
      {/* keyed by path so the menu closes after you pick a page */}
      <details key={path} className="group/more relative shrink-0">
        {/* no overflow-x on the nav: it would clip this menu */}
        <summary className={`${tab(inMore)} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
          More <svg aria-hidden viewBox="0 0 20 20" className="ml-1 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 5 5 5-5" /></svg>{bar(inMore)}
        </summary>
        <ul className="absolute left-0 top-full z-30 mt-1 min-w-48 rounded-xl border border-line bg-card p-1.5 shadow-lg">
          {MORE.map(([l, h]) => (
            <li key={h}><Link href={h} aria-current={on(path, h) ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-[15px] ${on(path, h) ? "bg-paper font-semibold text-ink" : "text-muted hover:bg-paper hover:text-ink"}`}>{l}</Link></li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
