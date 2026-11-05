"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "@/components/Avatar";

export type Row = { id: string; kind: string; name: string; last: string; unread: number; oid: string | null; avatar: string | null };

// Persistent list + thread shell: switching chats only swaps the right pane.
export default function ConvList({ rows, children }: { rows: Row[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const selected = pathname.startsWith("/messages/") ? pathname.split("/")[2] : null;
  const pinned = rows.filter((r) => r.kind !== "direct");
  const direct = rows.filter((r) => r.kind === "direct");

  const row = (r: Row) => {
    const active = r.id === selected;
    const unread = active ? 0 : r.unread;
    const avatar = r.kind === "system"
      ? <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-card">HQ</span>
      : <Avatar url={r.avatar} name={r.name} size={40} />;
    return (
      <li key={r.id} className={`flex min-h-16 items-center gap-3 border-l-2 px-3 py-2.5 transition-colors ${active ? "border-accent bg-paper" : "border-transparent hover:bg-paper"}`}>
        {r.oid ? <Link href={`/people/${r.oid}`} aria-label={`View ${r.name}'s profile`} className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{avatar}</Link> : avatar}
        <Link href={`/messages/${r.id}`} aria-current={active ? "true" : undefined} className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 flex-1">
            <span className={`block truncate ${unread ? "font-bold" : "font-semibold"}`}>{r.name}</span>
            <span className={`block truncate text-sm ${unread ? "text-ink" : "text-muted"}`}>{r.last}</span>
          </span>
          {unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">{unread}<span className="sr-only"> unread</span></span>}
          <span aria-hidden className="text-lg text-muted lg:hidden">›</span>
        </Link>
      </li>
    );
  };

  return (
    <div className="grid h-[calc(100dvh-13rem)] min-h-[26rem] lg:h-[calc(100dvh-12rem)] overflow-hidden rounded-lg border border-line bg-card lg:grid-cols-[minmax(18rem,1fr)_2fr]">
      <aside className={`${selected ? "hidden lg:block" : ""} overflow-y-auto border-line lg:border-r`}>
        {pinned.length > 0 && <ul className="mt-1">{pinned.map(row)}</ul>}
        {direct.length > 0 && <ul className="mt-1 pb-2">{direct.map(row)}</ul>}
      </aside>
      <section className={`${selected ? "flex" : "hidden lg:flex"} min-h-0 flex-col`}>{children}</section>
    </div>
  );
}
