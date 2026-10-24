"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({ href, children, badge = 0 }: { href: string; children: React.ReactNode; badge?: number }) {
  const path = usePathname();
  const active = path === href || path.startsWith(href + "/");
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[15px] font-medium ${active ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink"}`}>
      {children}
      {badge > 0 && (
        <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold leading-none text-on-primary">
          {badge}<span className="sr-only"> new</span>
        </span>
      )}
    </Link>
  );
}
