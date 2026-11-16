"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export type BannerItem = { id: string; message: string; link_url: string | null; link_label: string | null; tone: string };
const KEY = "dismissed-banners";

// Messages from the organizers. Closing one hides it on this device (remembered per banner).
export default function BannerList({ banners }: { banners: BannerItem[] }) {
  const [gone, setGone] = useState<string[] | null>(null); // null until we've read storage, so nothing flashes
  useEffect(() => {
    try { setGone(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { setGone([]); }
  }, []);
  const close = (id: string) => {
    const next = [...(gone ?? []), id];
    setGone(next);
    try { localStorage.setItem(KEY, JSON.stringify(next.slice(-50))); } catch { /* private mode: it just returns next visit */ }
  };
  const shown = gone ? banners.filter((b) => !gone.includes(b.id)) : [];
  if (!shown.length) return null;
  return (
    <div className="mb-6 space-y-3">
      {shown.map((b) => {
        const warn = b.tone === "warn";
        return (
          <aside key={b.id} aria-label="Message from the organizers" className={`flex items-start gap-4 rounded-xl border bg-card py-4 pl-5 pr-3 ${warn ? "border-warn/60" : "border-line"} border-l-4 ${warn ? "border-l-warn" : "border-l-accent"}`}>
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-muted">Message from the organizers</p>
              <p className="mt-1 text-[16px] leading-snug text-ink">{b.message}</p>
              {b.link_url && (b.link_url.startsWith("/")
                ? <Link href={b.link_url} className="link-draw mt-2 inline-block text-[15px] font-semibold">{b.link_label ?? "Learn more"} <span aria-hidden>→</span></Link>
                : <a href={b.link_url} target="_blank" rel="noopener noreferrer" className="link-draw mt-2 inline-block text-[15px] font-semibold">{b.link_label ?? "Learn more"} <span aria-hidden>→</span></a>)}
            </div>
            <button type="button" onClick={() => close(b.id)} aria-label="Dismiss message" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
            </button>
          </aside>
        );
      })}
    </div>
  );
}
