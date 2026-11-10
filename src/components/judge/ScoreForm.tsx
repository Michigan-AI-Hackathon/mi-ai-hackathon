"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveReview } from "@/app/judge/actions";
import type { JudgeCriterion } from "@/lib/judge-data";

export default function ScoreForm({ team, criteria, initialScores, initialComment, nextHref, nextLabel }: {
  team: string; criteria: JudgeCriterion[]; initialScores: Record<string, number>; initialComment: string; nextHref: string; nextLabel: string;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, string>>(Object.fromEntries(Object.entries(initialScores).map(([k, v]) => [k, String(v)])));
  const [comment, setComment] = useState(initialComment);
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  const total = criteria.reduce((n, c) => n + (Number(scores[c.id]) || 0), 0);
  const max = criteria.reduce((n, c) => n + c.max_score, 0);
  const bad = criteria.some((c) => scores[c.id] !== undefined && scores[c.id] !== "" && !(Number.isInteger(Number(scores[c.id])) && Number(scores[c.id]) >= 0 && Number(scores[c.id]) <= c.max_score));

  function save(go: boolean) {
    start(async () => {
      const r = await saveReview(team, scores, comment);
      setMsg(r);
      if (r?.ok) { router.refresh(); if (go) router.push(nextHref); }
    });
  }
  if (criteria.length === 0) return <p className="panel text-[15px]">The scoring rubric is not set up yet.</p>;
  return (
    <form className="panel space-y-5" onSubmit={(e) => { e.preventDefault(); save(false); }}>
      <ul className="space-y-4">
        {criteria.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor={`s-${c.id}`} className="font-semibold">{c.name}</label>
              {c.description && <p className="text-sm text-muted">{c.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <input id={`s-${c.id}`} inputMode="numeric" className="input w-20 text-center font-mono text-lg" value={scores[c.id] ?? ""}
                onChange={(e) => { setScores((s) => ({ ...s, [c.id]: e.target.value.replace(/\D/g, "").slice(0, 3) })); setMsg(null); }} />
              <span className="font-mono text-muted">/ {c.max_score}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="font-mono text-lg font-bold">Total {total} / {max}</p>
      <div>
        <label htmlFor="comment" className="label">Comments (only organizers see these)</label>
        <textarea id="comment" className="input min-h-28" maxLength={2000} value={comment} onChange={(e) => { setComment(e.target.value); setMsg(null); }} />
      </div>
      {bad && <p role="alert" className="text-sm text-danger">Each score must be a whole number from 0 to its maximum.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending || bad}>{pending ? "Saving…" : "Save scores"}</button>
        <button type="button" className="btn-secondary" disabled={pending || bad} onClick={() => save(true)}>{nextLabel}</button>
        {msg?.error && <span role="alert" className="text-sm text-danger">{msg.error}</span>}
        {msg?.ok && <span role="status" className="text-sm text-ok">{msg.ok}</span>}
      </div>
    </form>
  );
}
