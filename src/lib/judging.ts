// Shared types and the score arithmetic for judging. Pure functions, no database access.
export type Criterion = { id: string; name: string; description: string | null; max_score: number; active: boolean };
export type JudgeRow = { id: string; email: string; name: string | null; org: string | null; signed_in: boolean; tracks: string[]; teams: string[] };
export type TeamRow = { id: string; number: number | null; name: string; track: string | null; members: number };
export type ScoreRow = { judge: string; team: string; criterion: string; score: number };
export type ReviewRow = { judge: string; team: string; comment: string | null; updated_at: string };
export type JudgingData = { criteria: Criterion[]; judges: JudgeRow[]; teams: TeamRow[]; scores: ScoreRow[]; reviews: ReviewRow[] };

export type Ranked = {
  team: TeamRow;
  judgesDone: number;            // judges who scored every active criterion
  average: number | null;        // mean of those judges' totals
  averagePct: number | null;     // average as % of the maximum, comparable across rubrics
  perJudge: { judge: JudgeRow; total: number; complete: boolean; byCriterion: Record<string, number | undefined>; comment: string | null }[];
  rank: number | null;
};

export const label = (t: TeamRow) => `${t.number != null ? `#${t.number} ` : ""}${t.name}`;
export const judgeLabel = (j: JudgeRow) => j.name || j.email;

// A judge's total only counts once they have scored every active criterion for that team.
export function tabulate(d: JudgingData, track?: string): Ranked[] {
  const crit = d.criteria.filter((c) => c.active);
  const max = crit.reduce((n, c) => n + c.max_score, 0);
  const rows: Ranked[] = d.teams.filter((t) => !track || t.track === track).map((team) => {
    const perJudge = d.judges.map((judge) => {
      const mine = d.scores.filter((s) => s.judge === judge.id && s.team === team.id);
      const byCriterion: Record<string, number | undefined> = {};
      mine.forEach((s) => { byCriterion[s.criterion] = s.score; });
      const total = crit.reduce((n, c) => n + (byCriterion[c.id] ?? 0), 0);
      const complete = crit.length > 0 && crit.every((c) => byCriterion[c.id] !== undefined);
      const review = d.reviews.find((r) => r.judge === judge.id && r.team === team.id);
      return { judge, total, complete, byCriterion, comment: review?.comment ?? null, touched: mine.length > 0 || !!review };
    }).filter((p) => p.touched).map((p) => ({ judge: p.judge, total: p.total, complete: p.complete, byCriterion: p.byCriterion, comment: p.comment }));
    const done = perJudge.filter((p) => p.complete);
    const average = done.length ? done.reduce((n, p) => n + p.total, 0) / done.length : null;
    return { team, judgesDone: done.length, average, averagePct: average != null && max > 0 ? (average / max) * 100 : null, perJudge, rank: null };
  });
  const scored = rows.filter((r) => r.average != null).sort((a, b) => (b.average! - a.average!) || (a.team.number ?? 1e9) - (b.team.number ?? 1e9));
  scored.forEach((r, i) => { r.rank = i > 0 && r.average === scored[i - 1].average ? scored[i - 1].rank : i + 1; });
  const unscored = rows.filter((r) => r.average == null).sort((a, b) => (a.team.number ?? 1e9) - (b.team.number ?? 1e9));
  return [...scored, ...unscored];
}
