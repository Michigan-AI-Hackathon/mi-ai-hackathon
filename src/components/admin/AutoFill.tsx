"use client";
import { useState, useTransition } from "react";
import ActionButton from "@/components/ActionButton";
import { applyPlan, generatePlan } from "@/app/admin/actions";
import type { Plan } from "@/lib/autofill";

// Step 1: suggest. Step 2: the organizer reviews. Step 3: apply (the database re-checks every rule).
export default function AutoFill({ solos, openSeats }: { solos: number; openSeats: number }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [email, setEmail] = useState(true);
  const placed = plan?.groups.reduce((n, g) => n + g.students.length, 0) ?? 0;

  return (
    <section className="panel">
      <h2 className="font-heading text-2xl font-semibold">Fill teams automatically</h2>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">
        {solos} paid students have no team and {openSeats} seats are open on unlocked teams. We&apos;ll first fill open seats, then make new teams of 4. Nothing changes until you press Apply.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={pending || solos === 0}
          onClick={() => start(async () => { setError(null); const r = await generatePlan(); if (r.error) setError(r.error); else setPlan(r.plan ?? null); })}>
          {pending ? "Working…" : plan ? "Suggest again" : "Suggest teams"}
        </button>
        {error && <span role="alert" className="text-sm text-danger">{error}</span>}
      </div>

      {plan && (
        <div className="mt-6 space-y-4">
          <p className="text-[15px]"><strong>{placed}</strong> students placed across <strong>{plan.groups.length}</strong> teams{plan.leftover.length > 0 && <>, <strong className="text-warn">{plan.leftover.length}</strong> can&apos;t be placed without breaking a school rule</>}.</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {plan.groups.map((g, i) => (
              <li key={i} className="rounded-xl border border-line bg-paper p-4">
                <p className="font-heading text-lg font-semibold">{g.name}{g.existing && <span className="ml-2 chip">Fills an existing team</span>}</p>
                <p className="text-sm text-muted">{g.track ?? "No track"}</p>
                <ul className="mt-2 text-[14px]">
                  {g.keep.map((n) => <li key={n} className="text-muted">{n} (already on the team)</li>)}
                  {g.students.map((s) => <li key={s.id}><strong>{s.name}</strong> <span className="text-muted">· {s.school}</span></li>)}
                </ul>
              </li>
            ))}
          </ul>
          {plan.leftover.length > 0 && (
            <p className="text-[14px] text-muted">Left for you to place by hand: {plan.leftover.map((s) => `${s.name} (${s.school})`).join(", ")}.</p>
          )}
          <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="accent-primary" />Email each placed student their team</label>
          <ActionButton confirm={`Place ${placed} students on teams${email ? " and email them" : ""}? This is logged.`}
            action={async () => { const r = await applyPlan(plan, email); if (r?.ok) setPlan(null); return r; }}>Apply plan</ActionButton>
        </div>
      )}
    </section>
  );
}
