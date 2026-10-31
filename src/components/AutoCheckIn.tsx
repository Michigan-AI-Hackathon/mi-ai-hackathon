"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { selfCheckIn } from "@/app/actions";

// Runs the check-in the moment the page opens (as a POST, so a link alone can never check anyone in).
export default function AutoCheckIn({ token, name }: { token: string; name: string }) {
  const [state, setState] = useState<"working" | "done" | { error: string }>("working");
  const ran = useRef(false);
  const run = async () => { setState("working"); const r = await selfCheckIn(token); setState(r?.error ? { error: r.error } : "done"); };
  useEffect(() => { if (!ran.current) { ran.current = true; run(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === "working") return <div className="grid place-items-center py-16"><span className="h-12 w-12 animate-spin rounded-full border-4 border-line border-t-ink" aria-label="Checking you in" /></div>;
  if (state === "done") return (
    <div className="text-center">
      <span className="rise mx-auto grid h-24 w-24 place-items-center rounded-full bg-ink text-card" style={{ "--i": 0 } as React.CSSProperties}>
        <svg viewBox="0 0 20 20" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
      </span>
      <h1 className="rise mt-8 font-heading text-4xl font-bold" style={{ "--i": 1 } as React.CSSProperties}>You&apos;re checked in, {name}.</h1>
      <p className="rise mt-3 text-[16px] text-muted" style={{ "--i": 2 } as React.CSSProperties}>Find your team and have a great 24 hours.</p>
      <Link href="/team" className="btn-primary rise mt-8 px-6 py-3" style={{ "--i": 3 } as React.CSSProperties}>Go to my team</Link>
    </div>
  );
  return (
    <div className="text-center">
      <h1 className="font-heading text-3xl font-bold">We couldn&apos;t check you in</h1>
      <p role="alert" className="mt-3 text-[16px] text-danger">{state.error}</p>
      <div className="mt-6 flex justify-center gap-3"><button className="btn-primary" onClick={run}>Try again</button><Link href="/dashboard" className="btn-secondary">Dashboard</Link></div>
    </div>
  );
}
