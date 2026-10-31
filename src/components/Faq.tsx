"use client";
import { useState } from "react";

export type FaqItem = { q: string; a: React.ReactNode };

// One question open at a time; the answer height animates smoothly.
export default function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={it.q}>
            <h3>
              <button type="button" aria-expanded={isOpen} aria-controls={`faq-${i}`} onClick={() => setOpen(isOpen ? null : i)}
                className="group flex w-full items-center justify-between gap-6 py-5 text-left font-heading text-lg font-semibold sm:text-xl">
                <span className="transition-colors group-hover:text-primary">{it.q}</span>
                <span aria-hidden className={`relative h-5 w-5 shrink-0 transition-transform duration-500 [transition-timing-function:var(--ease-spring)] ${isOpen ? "rotate-45" : ""}`}>
                  <span className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-ink" />
                  <span className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-ink" />
                </span>
              </button>
            </h3>
            <div id={`faq-${i}`} role="region" className={`grid transition-[grid-template-rows,opacity] duration-500 [transition-timing-function:var(--ease-out)] ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="overflow-hidden">
                <div className="max-w-2xl pb-6 text-[16px] leading-relaxed text-muted">{it.a}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
