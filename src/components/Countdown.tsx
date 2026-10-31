"use client";
import { useEffect, useState } from "react";

function parts(target: number, now: number) {
  const s = Math.max(0, Math.floor((target - now) / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

// One digit. Changing the key replays the roll-in animation, so each tick feels mechanical.
function Digit({ d }: { d: string }) {
  return (
    <span className="relative inline-block h-[1em] w-[0.62em] overflow-hidden text-center">
      <span key={d} className="roll-in absolute inset-0 block">{d}</span>
      <span className="invisible">{d}</span>
    </span>
  );
}

export default function Countdown({ to, size = "lg" }: { to: string; size?: "lg" | "sm" }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = now === null ? null : parts(target, now);

  if (size === "sm") {
    return <span className="font-mono tabular-nums">{p ? `${p.days}d ${p.hours}h ${p.minutes}m` : "—"}</span>;
  }

  const units: [keyof NonNullable<typeof p>, string, number][] = [["days", "Days", 3], ["hours", "Hours", 2], ["minutes", "Minutes", 2], ["seconds", "Seconds", 2]];
  return (
    <div role="timer" aria-label="Time until the hackathon starts">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-on-hero/70">
        <span className="pulse-dot h-2 w-2 rounded-full bg-volt" aria-hidden />
        T-minus · live
      </div>
      <div className="mt-5 flex items-start gap-1 sm:gap-3">
        {units.map(([k, label, width], idx) => (
          <div key={k} className="flex items-start gap-1 sm:gap-3">
            <div>
              <div className="flex rounded-md border border-on-hero/15 bg-on-hero/[0.04] px-2 py-2 font-mono text-[2.1rem] font-semibold leading-none text-volt tabular-nums sm:px-4 sm:py-4 sm:text-7xl lg:text-8xl">
                {(p ? String(p[k]).padStart(width === 3 ? 2 : 2, "0") : "-".repeat(2)).split("").map((d, j) => <Digit key={j} d={d} />)}
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-on-hero/60 sm:text-xs">{label}</p>
            </div>
            {idx < units.length - 1 && <span aria-hidden className="pt-1 font-mono text-2xl text-on-hero/30 sm:pt-3 sm:text-5xl">:</span>}
          </div>
        ))}
      </div>
      {/* 60 ticks: one lights up per second */}
      <div className="mt-6 flex h-3 items-end gap-[2px]" aria-hidden>
        {Array.from({ length: 60 }, (_, i) => (
          <span key={i} className="flex-1 rounded-[1px] transition-all duration-300"
            style={{ height: p && i === p.seconds ? "100%" : i % 5 === 0 ? "55%" : "30%",
                     background: p && i <= p.seconds ? "var(--color-hero-accent)" : "color-mix(in srgb, var(--color-hero-text) 22%, transparent)",
                     opacity: p && i <= p.seconds ? 0.35 + (i / 60) * 0.65 : 1 }} />
        ))}
      </div>
    </div>
  );
}
