import "server-only";
import { requireJudge } from "@/lib/judge";

export type JudgeCriterion = { id: string; name: string; description: string | null; max_score: number };
export type JudgeTeam = {
  id: string; number: number | null; name: string; track: string | null;
  members: { name: string; school: string | null }[]; scores: Record<string, number>; comment: string | null;
};

export async function loadJudgeData() {
  const { supabase, judge } = await requireJudge();
  const { data } = await supabase.rpc("judge_overview");
  const o = (data ?? { criteria: [], teams: [] }) as { criteria: JudgeCriterion[]; teams: JudgeTeam[] };
  return { judge, criteria: o.criteria, teams: o.teams };
}
export const scoredCount = (t: JudgeTeam, crit: JudgeCriterion[]) => crit.filter((c) => t.scores[c.id] !== undefined).length;
