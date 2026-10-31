"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, UUID } from "@/lib/admin";
import { buildPlan, type Candidate, type OpenTeam, type Plan } from "@/lib/autofill";
import { sendBroadcast, sendPlacementEmails } from "@/lib/email";
import type { ActionResult } from "@/app/actions";

const msg = (e: { message: string } | null) => e?.message ?? "Something went wrong. Try again.";

// Every organizer action: re-check the caller is an organizer, validate ids, then call a database
// function that checks again and writes the audit log. Nothing here writes to a table directly.
async function adminRpc(fn: string, args: Record<string, unknown>, ok: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  for (const v of Object.values(args)) if (typeof v === "string" && v.length === 36 && !UUID.test(v)) return { error: "Bad request." };
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: msg(error) };
  revalidatePath("/admin", "layout");
  return { ok };
}
const id = (v: string) => (UUID.test(v) ? v : "");

export async function adminAddToTeam(student: string, team: string, force: boolean) {
  if (!id(student) || !id(team)) return { error: "Pick a team." } as ActionResult;
  return adminRpc("admin_add_to_team", { p_student: student, p_team: team, p_force: !!force }, "Student placed.");
}
export async function adminRemoveFromTeam(student: string) { return adminRpc("admin_remove_from_team", { p_student: id(student) }, "Removed from team."); }
export async function adminSetTeamLock(team: string, locked: boolean) { return adminRpc("admin_set_team_lock", { p_team: id(team), p_locked: !!locked }, locked ? "Team locked." : "Team unlocked."); }
export async function adminDissolveTeam(team: string) { return adminRpc("admin_dissolve_team", { p_team: id(team) }, "Team dissolved."); }
export async function adminComp(student: string, note: string) { return adminRpc("admin_comp_student", { p_student: id(student), p_note: note.slice(0, 200) }, "Marked paid."); }
export async function adminCheckIn(student: string, checkedIn: boolean) { return adminRpc("admin_set_checked_in", { p_student: id(student), p_in: !!checkedIn }, checkedIn ? "Checked in." : "Check-in undone."); }

export async function adminSetCheckin(open: boolean, rotate: boolean) {
  return adminRpc("admin_set_checkin", { p_open: !!open, p_rotate: !!rotate }, rotate ? "New code made. Reprint the QR code." : open ? "Check-in is open." : "Check-in is closed.");
}

// ----------------------------------------------------------- events (sign-up QR codes)
export async function adminCreateEvent(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const date = String(form.get("date") ?? "");
  if (name.length < 2) return { error: "Give the event a name." };
  const { error } = await supabase.rpc("admin_create_source", { p_name: name, p_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null });
  if (error) return { error: msg(error) };
  revalidatePath("/admin", "layout");
  return { ok: "Event created. Its QR code is below." };
}
export async function adminSetEventActive(idv: string, active: boolean) { return adminRpc("admin_set_source_active", { p_id: id(idv), p_active: !!active }, active ? "QR code is on." : "QR code is off. Scans now show a generic page."); }

// ----------------------------------------------------------- auto team filling
export async function generatePlan(): Promise<{ error?: string; plan?: Plan }> {
  const { supabase } = await requireAdmin();
  const [{ data: schools }, { data: members }, { data: teams }, { data: people }] = await Promise.all([
    supabase.from("schools").select("id, name, rule_group"),
    supabase.from("team_members").select("team_id, user_id"),
    supabase.from("teams").select("id, name, track, locked_at").is("locked_at", null),
    supabase.from("profiles").select("id, full_name, school_id, tracks, skills, onboarded_at, paid_at, created_at").not("onboarded_at", "is", null).not("paid_at", "is", null).order("created_at", { ascending: true }).limit(2000),
  ]);
  const school = new Map((schools ?? []).map((s) => [s.id as number, s as { id: number; name: string; rule_group: string | null }]));
  const toC = (p: { id: string; full_name: string | null; school_id: number; tracks: string[]; skills: string[] }): Candidate => {
    const s = school.get(p.school_id);
    return { id: p.id, name: p.full_name ?? "Student", group: s?.rule_group ?? `school-${p.school_id}`, school: s?.name ?? "", tracks: p.tracks ?? [], skills: p.skills ?? [] };
  };
  const onTeam = new Map<string, string>((members ?? []).map((m) => [m.user_id as string, m.team_id as string]));
  const solos = (people ?? []).filter((p) => !onTeam.has(p.id)).map(toC);
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]));
  const open: OpenTeam[] = (teams ?? []).map((t) => ({
    id: t.id, name: t.name, track: t.track,
    members: (members ?? []).filter((m) => m.team_id === t.id).map((m) => byId.get(m.user_id)).filter(Boolean).map((p) => toC(p!)),
  })).filter((t) => t.members.length < 4);
  const sizes = new Map<string, number>(); (members ?? []).forEach((m) => sizes.set(m.team_id, (sizes.get(m.team_id) ?? 0) + 1));
  // teams whose members we could not load (e.g. someone unpaid) still count toward the size
  const real = open.filter((t) => (sizes.get(t.id) ?? 0) === t.members.length);
  const { data: allNames } = await supabase.from("teams").select("name");
  return { plan: buildPlan(solos, real, (allNames ?? []).map((t) => t.name as string)) };
}

export async function applyPlan(plan: Plan, sendEmails: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const groups = plan?.groups;
  if (!Array.isArray(groups) || groups.length === 0 || groups.length > 200) return { error: "Nothing to apply." };
  const clean = groups.map((g) => ({
    team_id: g.team_id && UUID.test(g.team_id) ? g.team_id : null,
    name: String(g.name ?? "").slice(0, 40), track: g.track ? String(g.track).slice(0, 40) : null,
    students: (g.students ?? []).map((s) => s.id).filter((x) => UUID.test(x)),
  }));
  const { data: n, error } = await supabase.rpc("admin_apply_plan", { p_plan: clean });
  if (error) return { error: msg(error) };
  let note = "";
  if (sendEmails) {
    try {
      const ids = clean.flatMap((g) => g.students);
      const { data: ppl } = await supabase.from("profiles").select("id, email, full_name").in("id", ids);
      const rows = groups.flatMap((g) => g.students.map((s) => {
        const p = ppl?.find((x) => x.id === s.id);
        return p ? { email: p.email as string, full_name: p.full_name as string | null, team: g.name, mates: [...g.keep, ...g.students.filter((x) => x.id !== s.id).map((x) => x.name)] } : null;
      })).filter(Boolean) as { email: string; full_name: string | null; team: string; mates: string[] }[];
      const r = await sendPlacementEmails(rows);
      note = "skipped" in r ? " Emails skipped (no RESEND_API_KEY)." : ` Emailed ${r.sent} students.`;
    } catch (e) { note = ` Placed, but emails failed: ${(e as Error).message}`; }
  }
  revalidatePath("/admin", "layout");
  return { ok: `Placed ${n} students.${note}` };
}

// ----------------------------------------------------------- broadcast
export type Audience = "everyone" | "unpaid" | "no-team" | "unlocked-teams" | "checked-in";
async function audience(a: Audience) {
  const { supabase } = await requireAdmin();
  const { data: members } = await supabase.from("team_members").select("team_id, user_id");
  const { data: teams } = await supabase.from("teams").select("id, locked_at");
  const onTeam = new Set((members ?? []).map((m) => m.user_id as string));
  const unlocked = new Set((teams ?? []).filter((t) => !t.locked_at).map((t) => t.id as string));
  const inUnlocked = new Set((members ?? []).filter((m) => unlocked.has(m.team_id)).map((m) => m.user_id as string));
  const { data: ppl } = await supabase.from("profiles").select("id, email, full_name, paid_at, onboarded_at, checked_in_at").limit(5000);
  const list = (ppl ?? []).filter((p) => {
    if (a === "everyone") return true;
    if (a === "unpaid") return !p.paid_at;
    if (a === "no-team") return !!p.paid_at && !onTeam.has(p.id);
    if (a === "unlocked-teams") return inUnlocked.has(p.id);
    if (a === "checked-in") return !!p.checked_in_at;
    return false;
  });
  return { supabase, list: list as { id: string; email: string; full_name: string | null }[] };
}
export async function audienceCounts() {
  const out = {} as Record<Audience, number>;
  for (const a of ["everyone", "unpaid", "no-team", "unlocked-teams", "checked-in"] as Audience[]) out[a] = (await audience(a)).list.length;
  return out;
}
export async function sendAnnouncement(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const a = String(form.get("audience") ?? "") as Audience;
  const subject = String(form.get("subject") ?? "").trim().slice(0, 120);
  const body = String(form.get("body") ?? "").trim().slice(0, 1800);
  const viaEmail = form.get("email") === "on", viaInbox = form.get("inbox") === "on";
  if (!["everyone", "unpaid", "no-team", "unlocked-teams", "checked-in"].includes(a)) return { error: "Pick who to send it to." };
  if (subject.length < 3 || body.length < 10) return { error: "Add a subject and a message." };
  if (!viaEmail && !viaInbox) return { error: "Choose email, Messages, or both." };
  const { supabase, list } = await audience(a);
  // brake: at most 3 announcements in any 10 minutes, so a stolen session can't spam everyone
  const { count } = await supabase.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "broadcast").gt("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
  if ((count ?? 0) >= 3) return { error: "Slow down: 3 announcements were already sent in the last 10 minutes." };
  if (!list.length) return { error: "No one matches that audience." };
  const parts: string[] = [];
  let inboxed = 0, emailed = 0;
  if (viaInbox) {
    for (let i = 0; i < list.length; i += 1000) {
      const { data, error } = await supabase.rpc("admin_post_announcement", { p_users: list.slice(i, i + 1000).map((p) => p.id), p_subject: subject, p_body: body });
      if (error) return { error: `Couldn't post to Messages: ${msg(error)}` };
      inboxed += (data as number) ?? 0;
    }
    parts.push(`posted to ${inboxed} students' Messages`);
  }
  if (viaEmail) {
    try {
      const r = await sendBroadcast(list, subject, body);
      if ("skipped" in r) parts.push(`email skipped (${r.skipped})`); else { emailed = r.sent; parts.push(`emailed ${emailed}`); }
    } catch (e) { parts.push(`email failed (${(e as Error).message})`); }
  }
  await supabase.rpc("admin_log_event", { p_action: "broadcast", p_details: { audience: a, recipients: list.length, subject, inbox: inboxed, emailed } });
  revalidatePath("/admin", "layout");
  return { ok: `Done: ${parts.join(", ")}.` };
}
