"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, UUID } from "@/lib/admin";
import type { ActionResult } from "@/app/actions";

const msg = (e: { message: string } | null) => e?.message ?? "Something went wrong. Try again.";

async function rpc(fn: string, args: Record<string, unknown>, ok: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: msg(error) };
  revalidatePath("/admin/judging", "layout");
  return { ok };
}

export async function addJudge(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return rpc("admin_add_judge", {
    p_email: String(form.get("email") ?? "").slice(0, 200), p_name: String(form.get("name") ?? "").slice(0, 80), p_org: String(form.get("org") ?? "").slice(0, 80),
  }, "Judge added. They can now sign in at /judge with that email.");
}
export async function removeJudge(judge: string): Promise<ActionResult> {
  if (!UUID.test(judge)) return { error: "Bad request." };
  return rpc("admin_remove_judge", { p_judge: judge }, "Judge removed.");
}
export async function setAssignments(judge: string, tracks: string[], teams: string[]): Promise<ActionResult> {
  if (!UUID.test(judge) || !Array.isArray(tracks) || !Array.isArray(teams) || !teams.every((t) => UUID.test(t))) return { error: "Bad request." };
  return rpc("admin_set_judge_assignments", { p_judge: judge, p_tracks: tracks.map(String).slice(0, 20), p_teams: teams.slice(0, 500) }, "Assignments saved.");
}
export async function setTeamNumber(team: string, value: string): Promise<ActionResult> {
  if (!UUID.test(team)) return { error: "Bad request." };
  const v = value.trim();
  if (v !== "" && !/^\d{1,4}$/.test(v)) return { error: "Use a whole number." };
  return rpc("admin_set_team_number", { p_team: team, p_number: v === "" ? null : Number(v) }, "Saved.");
}
export async function autoNumber(all: boolean): Promise<ActionResult> {
  return rpc("admin_auto_number_teams", { p_all: !!all }, all ? "All teams renumbered." : "New teams numbered.");
}
export type CriterionInput = { id: string | null; name: string; description: string; max_score: number };
export async function saveCriteria(items: CriterionInput[]): Promise<ActionResult> {
  if (!Array.isArray(items) || items.length > 20) return { error: "Use up to 20 criteria." };
  const clean = items.map((i) => ({ id: i.id && UUID.test(i.id) ? i.id : null, name: String(i.name ?? "").slice(0, 60), description: String(i.description ?? "").slice(0, 200), max_score: Math.round(Number(i.max_score)) }));
  return rpc("admin_save_criteria", { p_items: clean }, "Rubric saved.");
}
