"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, UUID } from "@/lib/admin";
import type { ActionResult } from "@/app/actions";

const msg = (e: { message: string } | null) => e?.message ?? "Something went wrong. Try again.";

export async function saveMatchingSettings(size: number, force: boolean, trackWeight: number): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const s = size === 3 ? 3 : 4;
  const w = Math.min(10, Math.max(0, Number.isFinite(trackWeight) ? trackWeight : 3));
  const { error } = await supabase.rpc("admin_set_matching_settings", { p_size: s, p_force: !!force, p_track_weight: w });
  if (error) return { error: msg(error) };
  revalidatePath("/admin/matching");
  return { ok: "Settings saved." };
}

export type ApplyPayload = {
  force: boolean;
  releases: { student: string; team: string }[];
  marks: { student: string; team: string }[];
  teams: { team_id: string | null; name: string; track: string | null; students: string[] }[];
};

// Organizer clicked Apply. The database function does the real work in ONE transaction:
// it re-checks that the caller is an organizer, locks the teams, re-validates every school rule,
// writes the audit log, and changes nothing if anything fails.
export async function applyMatching(plan: ApplyPayload, notify: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const okId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
  const pair = (x: { student: string; team: string }) => okId(x?.student) && okId(x?.team);
  if (!plan || !Array.isArray(plan.releases) || !Array.isArray(plan.marks) || !Array.isArray(plan.teams)) return { error: "Bad request." };
  if (!plan.releases.every(pair) || !plan.marks.every(pair)) return { error: "Bad request." };
  if (!plan.teams.every((t) => (t.team_id === null || okId(t.team_id)) && Array.isArray(t.students) && t.students.every(okId))) return { error: "Bad request." };
  if (plan.releases.length + plan.marks.length + plan.teams.reduce((n, t) => n + t.students.length, 0) === 0) return { error: "Nothing to apply." };
  const clean = {
    force: !!plan.force,
    notify: !!notify, // the database posts the team-chat messages inside the same transaction
    releases: plan.releases.map((x) => ({ student: x.student, team: x.team })),
    marks: plan.marks.map((x) => ({ student: x.student, team: x.team })),
    teams: plan.teams.map((t) => ({ team_id: t.team_id, name: String(t.name ?? "").slice(0, 40), track: t.track ? String(t.track).slice(0, 40) : null, students: t.students })),
  };
  const { data, error } = await supabase.rpc("admin_apply_matching", { p_plan: clean });
  if (error) return { error: msg(error) };
  const r = data as { chat_messages?: number; placed: number; released: number; marked: number; new_teams: number; teams: { team_id: string; students: string[] }[] };
  let note = "";
  if (notify) {
    note = r.chat_messages ? ` Posted ${r.chat_messages} team-chat ${r.chat_messages === 1 ? "message" : "messages"}.` : "";
    try { note += await notifyReleased(supabase, clean); } catch (e) { note = ` Applied, but messages failed: ${(e as Error).message}`; }
  }
  revalidatePath("/admin", "layout");
  const bits = [r.placed && `${r.placed} placed`, r.new_teams && `${r.new_teams} new ${r.new_teams === 1 ? "team" : "teams"}`, r.released && `${r.released} released`, r.marked && `${r.marked} marked`].filter(Boolean);
  return { ok: `Done: ${bits.join(", ") || "no changes"}.${note}` };
}

// Team-chat messages for placements are posted by admin_apply_matching itself (same transaction).
// Released students get a short note in their Organizers inbox, same mechanism as announcements (no email).
async function notifyReleased(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], plan: ApplyPayload) {
  const teamIds = [...new Set(plan.releases.map((x) => x.team))];
  const { data: teams } = teamIds.length ? await supabase.from("teams").select("id, name").in("id", teamIds) : { data: [] };
  const team = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));
  let sent = 0, calls = 0;
  for (const rel of plan.releases) {
    if (calls++ > 150) break;
    const t = team.get(rel.team) ?? "your team";
    const { data } = await supabase.rpc("admin_post_announcement", {
      p_users: [rel.student], p_subject: `Your seat on ${t} was released`,
      p_body: `We did not see you check in, so an organizer released your seat on ${t}. If this is a mistake, find an organizer at the event.`,
    });
    sent += (data as number) ?? 0;
  }
  return sent ? ` Also sent ${sent} release ${sent === 1 ? "note" : "notes"}.` : "";
}
