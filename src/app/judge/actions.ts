"use server";
import { revalidatePath } from "next/cache";
import { requireJudge } from "@/lib/judge";
import { UUID } from "@/lib/admin";
import type { ActionResult } from "@/app/actions";

export async function saveReview(team: string, scores: Record<string, string>, comment: string): Promise<ActionResult> {
  const { supabase } = await requireJudge();
  if (!UUID.test(team)) return { error: "Bad request." };
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores ?? {})) {
    if (!UUID.test(k)) return { error: "Bad request." };
    if (String(v).trim() === "") continue;
    if (!/^\d{1,3}$/.test(String(v).trim())) return { error: "Scores must be whole numbers." };
    clean[k] = Number(v);
  }
  const { error } = await supabase.rpc("judge_save_review", { p_team: team, p_scores: clean, p_comment: String(comment ?? "").slice(0, 2000) });
  if (error) return { error: error.message };
  revalidatePath("/judge", "layout");
  return { ok: "Saved." };
}
