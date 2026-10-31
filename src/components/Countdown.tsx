"use client";
import { useEffect, useState } from "react";

function parts(target: number, now: number) {
  const s = Math.max(0, Math.floor((target - now) / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

// One digit. Changing the key replays the roll-in, so each tick lands softly.
function Digit({ d }: { d: string }) {
  return <span key={d} className="roll-in inline-block">{d}</span>;
}

export default function Countdown({ to, size = "lg" }: { to: string; size?: "lg" | "md" | "sm" }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = now === null ? null : parts(target, now);

  if (size === "sm") {
    return <span className="tabular-nums">{p ? `${p.days}d ${p.hours}h ${p.minutes}m` : "—"}</span>;
  }

  const md = size === "md";
  const units: [keyof NonNullable<typeof p>, string][] = [["days", "Days"], ["hours", "Hours"], ["minutes", "Minutes"], ["seconds", "Seconds"]];
  return (
    <div role="timer" aria-label="Time until the hackathon starts" className="grid grid-cols-4 divide-x divide-on-hero/15">
      {units.map(([k, label], i) => (
        <div key={k} className={`${i === 0 ? "pr-3 sm:pr-8" : "px-3 sm:px-8"} min-w-0`}>
          <div className={`flex font-heading font-semibold leading-none tracking-tight tabular-nums ${md ? "text-3xl sm:text-4xl" : "text-[2.6rem] sm:text-7xl lg:text-[6.5rem]"}`}>
            {(p ? String(p[k]).padStart(2, "0") : "––").split("").map((d, j) => <Digit key={j} d={d} />)}
          </div>
          <p className={`text-on-hero/60 ${md ? "mt-2 text-xs" : "mt-3 text-xs sm:text-sm"}`}>{label}</p>
        </div>
      ))}
    </div>
  );
}
