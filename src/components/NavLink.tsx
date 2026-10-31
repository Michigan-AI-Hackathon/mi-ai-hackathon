"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({ href, children, badge = 0 }: { href: string; children: React.ReactNode; badge?: number }) {
  const path = usePathname();
  const active = path === href || path.startsWith(href + "/");
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`group relative flex shrink-0 items-center gap-2 px-3 py-3 text-[15px] font-medium transition-colors ${active ? "text-ink" : "text-muted hover:text-ink"}`}>
      {children}
      {badge > 0 && (
        <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none text-hero">
          {badge}<span className="sr-only"> new</span>
        </span>
      )}
      {/* underline grows from the left on hover, stays on the active page */}
      <span aria-hidden className={`absolute inset-x-3 bottom-0 h-[3px] origin-left rounded-full bg-accent transition-transform duration-300 [transition-timing-function:var(--ease-out)] ${active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
    </Link>
  );
}
