"use client";
import { useEffect, useState } from "react";

function parts(target: number, now: number) {
  const s = Math.max(0, Math.floor((target - now) / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
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
  const units: [keyof NonNullable<typeof p>, string][] = [["days", "days"], ["hours", "hours"], ["minutes", "min"], ["seconds", "sec"]];

  if (size === "sm") {
    return (
      <span className="tabular-nums" aria-live="off">
        {p ? `${p.days}d ${p.hours}h ${p.minutes}m` : "—"}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-3 sm:gap-x-10" role="timer" aria-label="Time until the hackathon starts">
      {units.map(([k, label]) => (
        <div key={k} className="flex flex-col">
          <span className="font-heading text-[2.4rem] font-bold leading-none tabular-nums sm:text-7xl lg:text-8xl">
            {p ? String(p[k]).padStart(k === "days" ? 1 : 2, "0") : "–"}
          </span>
          <span className="mt-2 text-sm text-on-hero/75">{label}</span>
        </div>
      ))}
    </div>
  );
}
