"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { selfCheckIn } from "@/app/actions";

const tones = { ok: "bg-ink text-card", info: "bg-paper text-ink ring-1 ring-line", warn: "bg-accent/15 text-ink ring-1 ring-accent/40", bad: "bg-danger/10 text-danger ring-1 ring-danger/30" } as const;

// One big status, one big button. Used for every check-in outcome.
export function StatusScreen({ tone, title, text, href, cta, onClick }: { tone: keyof typeof tones; title: string; text?: string; href?: string; cta: string; onClick?: () => void }) {
  return (
    <div className="text-center" role={tone === "bad" ? "alert" : "status"}>
      <span aria-hidden className={`rise mx-auto grid h-24 w-24 place-items-center rounded-full ${tones[tone]}`} style={{ "--i": 0 } as React.CSSProperties}>
        {tone === "ok"
          ? <svg viewBox="0 0 20 20" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
          : <span className="font-heading text-5xl font-bold">{tone === "info" ? "?" : "!"}</span>}
      </span>
      <h1 className="rise mt-8 font-heading text-3xl font-bold sm:text-4xl" style={{ "--i": 1 } as React.CSSProperties}>{title}</h1>
      {text && <p className="rise mt-3 text-[17px] text-muted" style={{ "--i": 2 } as React.CSSProperties}>{text}</p>}
      <div className="rise mt-8" style={{ "--i": 3 } as React.CSSProperties}>
        {onClick ? <button className="btn-primary w-full py-4 text-lg" onClick={onClick}>{cta}</button> : <Link href={href ?? "/dashboard"} className="btn-primary w-full py-4 text-lg">{cta}</Link>}
      </div>
    </div>
  );
}

// Runs the check-in the moment the page opens (as a POST, so a link alone can never check anyone in).
// The database checks the token and who is signed in; this only shows the result.
export default function AutoCheckIn({ token, name, team }: { token: string; name: string; team: string | null }) {
  const [state, setState] = useState<"working" | "done" | { error: string }>("working");
  const ran = useRef(false);
  const run = async () => { setState("working"); const r = await selfCheckIn(token); setState(r?.error ? { error: r.error } : "done"); };
  useEffect(() => { if (!ran.current) { ran.current = true; run(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === "working") return <div className="grid place-items-center py-16"><span className="h-12 w-12 animate-spin rounded-full border-4 border-line border-t-ink" role="status" aria-label="Checking you in" /></div>;
  if (state === "done") return <StatusScreen tone="ok" title={`You're checked in, ${name}.`} text={team ? `Your team: ${team}.` : "You don't have a team yet."} href={team ? "/team" : "/teams"} cta={team ? "My team" : "Find a team"} />;
  return <StatusScreen tone="bad" title="We couldn't check you in" text={state.error} cta="Try again" onClick={run} />;
}
