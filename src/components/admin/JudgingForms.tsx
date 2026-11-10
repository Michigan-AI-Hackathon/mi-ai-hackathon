"use client";
import { useActionState, useState, useTransition } from "react";
import { addJudge, saveCriteria, setAssignments, setTeamNumber, type CriterionInput } from "@/app/admin/judging/actions";
import type { ActionResult } from "@/app/actions";

function Result({ r }: { r: ActionResult }) {
  if (r?.error) return <span role="alert" className="text-sm text-danger">{r.error}</span>;
  if (r?.ok) return <span role="status" className="text-sm text-ok">{r.ok}</span>;
  return null;
}

export function AddJudgeForm() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(addJudge, null);
  return (
    <form action={action} className="panel flex flex-wrap items-end gap-4">
      <div className="min-w-60 flex-1"><label htmlFor="j-email" className="label">Judge email</label><input id="j-email" name="email" type="email" required className="input" placeholder="judge@company.com" /></div>
      <div><label htmlFor="j-name" className="label">Name</label><input id="j-name" name="name" maxLength={80} className="input" /></div>
      <div><label htmlFor="j-org" className="label">Company</label><input id="j-org" name="org" maxLength={80} className="input" placeholder="e.g. Rocket Money" /></div>
      <button className="btn-primary" disabled={pending}>{pending ? "Adding…" : "Add judge"}</button>
      <div className="w-full"><Result r={state} /></div>
    </form>
  );
}

export function RubricEditor({ initial }: { initial: { id: string; name: string; description: string | null; max_score: number }[] }) {
  const [rows, setRows] = useState<CriterionInput[]>(initial.map((c) => ({ id: c.id, name: c.name, description: c.description ?? "", max_score: c.max_score })));
  const [res, setRes] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const upd = (i: number, p: Partial<CriterionInput>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: number) => setRows((r) => { const n = [...r]; const j = i + d; if (j < 0 || j >= n.length) return r; [n[i], n[j]] = [n[j], n[i]]; return n; });
  return (
    <div className="panel space-y-4">
      <ul className="space-y-3">
        {rows.map((c, i) => (
          <li key={c.id ?? `new-${i}`} className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[1fr_2fr_6rem_auto]">
            <div><label className="label" htmlFor={`cn-${i}`}>Criterion</label><input id={`cn-${i}`} className="input" maxLength={60} value={c.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="e.g. Innovation" /></div>
            <div><label className="label" htmlFor={`cd-${i}`}>What judges look for</label><input id={`cd-${i}`} className="input" maxLength={200} value={c.description} onChange={(e) => upd(i, { description: e.target.value })} /></div>
            <div><label className="label" htmlFor={`cm-${i}`}>Max score</label><input id={`cm-${i}`} className="input" type="number" min={1} max={100} value={c.max_score} onChange={(e) => upd(i, { max_score: Number(e.target.value) })} /></div>
            <div className="flex items-end gap-1">
              <button type="button" className="btn-secondary" aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="btn-secondary" aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="btn-danger" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>Remove</button>
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="text-[15px] text-muted">No criteria yet. Add the things judges should score.</li>}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" onClick={() => setRows((r) => [...r, { id: null, name: "", description: "", max_score: 10 }])}>Add criterion</button>
        <button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => setRes(await saveCriteria(rows)))}>{pending ? "Saving…" : "Save rubric"}</button>
        <span className="text-sm text-muted">Total possible: {rows.reduce((n, r) => n + (Number(r.max_score) || 0), 0)}</span>
        <Result r={res} />
      </div>
    </div>
  );
}

export function TeamNumberInput({ team, value }: { team: string; value: number | null }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  const [res, setRes] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <input aria-label="Team number" inputMode="numeric" className="input w-20 text-center" value={v} disabled={pending}
        onChange={(e) => { setV(e.target.value.replace(/\D/g, "").slice(0, 4)); setRes(null); }}
        onBlur={() => { if (v !== (value == null ? "" : String(value))) start(async () => setRes(await setTeamNumber(team, v))); }} />
      <Result r={res} />
    </span>
  );
}

export function JudgeAssign({ judge, allTracks, teams, tracks, teamIds }: {
  judge: string; allTracks: string[]; teams: { id: string; label: string }[]; tracks: string[]; teamIds: string[];
}) {
  const [t, setT] = useState(new Set(tracks));
  const [m, setM] = useState(new Set(teamIds));
  const [res, setRes] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const flip = (s: Set<string>, k: string) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; };
  return (
    <div className="space-y-3">
      <fieldset><legend className="label">Sees every team in these tracks</legend>
        <div className="flex flex-wrap gap-2">{allTracks.map((x) => (
          <label key={x} className={`chip cursor-pointer px-3 py-1.5 ${t.has(x) ? "border-ink bg-ink text-card" : ""}`}>
            <input type="checkbox" className="sr-only" checked={t.has(x)} onChange={() => setT((s) => flip(s, x))} />{x}
          </label>
        ))}</div>
      </fieldset>
      <details><summary className="cursor-pointer text-[15px] font-semibold">Or specific teams ({m.size} picked)</summary>
        <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">{teams.map((x) => (
          <label key={x.id} className="flex items-center gap-2 text-[15px]"><input type="checkbox" checked={m.has(x.id)} onChange={() => setM((s) => flip(s, x.id))} />{x.label}</label>
        ))}{teams.length === 0 && <p className="text-muted">No teams yet.</p>}</div>
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => setRes(await setAssignments(judge, [...t], [...m])))}>{pending ? "Saving…" : "Save assignments"}</button>
        <Result r={res} />
      </div>
    </div>
  );
}
