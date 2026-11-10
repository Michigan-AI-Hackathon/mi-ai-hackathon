import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { requireAdmin } from "@/lib/admin";
import { TRACKS } from "@/lib/config";
import { judgeLabel, tabulate, type JudgingData } from "@/lib/judging";

const f1 = (n: number | null) => (n == null ? "–" : (Math.round(n * 10) / 10).toString());

export default async function JudgingResults({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const { track } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_judging_data");
  if (error || !data) return <p className="panel text-danger" role="alert">Could not load results. {error?.message}</p>;
  const d = data as JudgingData;
  const crit = d.criteria.filter((c) => c.active);
  const max = crit.reduce((n, c) => n + c.max_score, 0);
  const tracks = [...new Set<string>([...TRACKS, ...d.teams.map((t) => t.track).filter(Boolean) as string[]])];
  const sel = track && tracks.includes(track) ? track : undefined;
  const rows = tabulate(d, sel);
  const csv = `/admin/judging/results.csv${sel ? `?track=${encodeURIComponent(sel)}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Judging" title="Results">Teams ranked by the average total across judges who finished scoring every criterion. Out of {max}.</PageHeader>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/admin/judging" className="chip px-3 py-1.5">Setup</Link>
        <span className="chip border-ink bg-ink px-3 py-1.5 text-card">Results</span>
        <span className="mx-2 text-muted">Track:</span>
        {[["", "All"], ...tracks.map((t) => [t, t])].map(([k, l]) => (
          <Link key={k} href={k ? `/admin/judging/results?track=${encodeURIComponent(k)}` : "/admin/judging/results"} className={`chip px-3 py-1.5 ${(sel ?? "") === k ? "border-ink bg-ink text-card" : ""}`}>{l}</Link>
        ))}
        <a href={csv} className="btn-secondary ml-auto">Download CSV</a>
      </div>

      <div className="panel overflow-x-auto p-0">
        <table className="w-full text-left text-[15px]">
          <thead><tr className="border-b border-line text-sm text-muted">
            <th className="p-3">Rank</th><th className="p-3">Team</th><th className="p-3">Track</th><th className="p-3">Avg</th><th className="p-3">%</th><th className="p-3">Judges</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team.id} className="border-b border-line align-top last:border-0">
                <td className="p-3 font-mono font-bold">{r.rank ?? "–"}</td>
                <td className="p-3">
                  <details>
                    <summary className="cursor-pointer font-semibold">{r.team.number != null && <span className="font-mono">#{r.team.number} </span>}{r.team.name}</summary>
                    <div className="mt-2 space-y-3 text-sm">
                      {r.perJudge.length === 0 && <p className="text-muted">No scores yet.</p>}
                      {r.perJudge.map((p) => (
                        <div key={p.judge.id} className="rounded-lg border border-line p-3">
                          <p className="font-semibold">{judgeLabel(p.judge)}{p.judge.org && <span className="font-normal text-muted"> · {p.judge.org}</span>} <span className="font-mono">{p.total}/{max}</span>{!p.complete && <span className="chip ml-2 border-warn text-warn">Incomplete</span>}</p>
                          <p className="mt-1 text-muted">{crit.map((c) => `${c.name}: ${p.byCriterion[c.id] ?? "–"}/${c.max_score}`).join(" · ")}</p>
                          {p.comment && <p className="mt-2 whitespace-pre-wrap">{p.comment}</p>}
                        </div>
                      ))}
                    </div>
                  </details>
                </td>
                <td className="p-3 text-muted">{r.team.track ?? "–"}</td>
                <td className="p-3 font-mono">{f1(r.average)}</td>
                <td className="p-3 font-mono">{r.averagePct == null ? "–" : `${Math.round(r.averagePct)}%`}</td>
                <td className="p-3 font-mono">{r.judgesDone}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-muted">No teams.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
