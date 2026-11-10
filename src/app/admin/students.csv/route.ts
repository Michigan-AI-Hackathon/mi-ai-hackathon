import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

// A spreadsheet can run =formulas pasted into a name or bio. Prefix anything that looks like one.
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const { supabase } = await requireAdmin();
  const url = new URL(req.url);
  const f = url.searchParams.get("f") ?? "all";
  const q = (url.searchParams.get("q") ?? "").replace(/[,()%*\\.]/g, " ").trim().slice(0, 60);
  let query = supabase.from("profiles").select("id, full_name, email, year, study_area, tracks, skills, pronouns, resume_path, placement_pref, onboarded_at, paid_at, checked_in_at, created_at, schools(name)").order("created_at").limit(5000);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  if (f === "unpaid") query = query.is("paid_at", null);
  if (f === "incomplete") query = query.is("onboarded_at", null);
  const [{ data }, { data: members }, { data: teams }] = await Promise.all([query, supabase.from("team_members").select("team_id, user_id"), supabase.from("teams").select("id, name")]);
  const teamName = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));
  const teamOf = new Map((members ?? []).map((m) => [m.user_id as string, m.team_id as string]));
  type R = { id: string; full_name: string | null; email: string; year: string | null; study_area: string | null; tracks: string[]; skills: string[]; pronouns: string | null; resume_path: string | null; placement_pref: string | null; onboarded_at: string | null; paid_at: string | null; checked_in_at: string | null; created_at: string; signup_source: string | null; schools: { name: string } | null };
  let rows = (data ?? []) as unknown as R[];
  if (f === "paid") rows = rows.filter((r) => r.paid_at);
  if (f === "solo") rows = rows.filter((r) => r.paid_at && r.onboarded_at && !teamOf.has(r.id));
  if (f === "team") rows = rows.filter((r) => teamOf.has(r.id));
  if (f === "checked") rows = rows.filter((r) => r.checked_in_at);
  // Resume links are signed for 7 days so the sheet is usable when sharing with partners (organizers only).
  const paths = rows.map((r) => r.resume_path).filter((x): x is string => !!x);
  const resumeUrl = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("resumes").createSignedUrls(paths, 24 * 3600);
    (signed ?? []).forEach((x) => { if (x.path && x.signedUrl) resumeUrl.set(x.path, x.signedUrl); });
  }
  const head = ["Name", "Pronouns", "Email", "School", "Year", "Study area", "Tracks", "Skills", "Profile done", "Paid", "Team", "Checked in", "Signed up", "Signup source", "Team placement", "Resume link"];
  const lines = [head.map(cell).join(",")].concat(rows.map((r) => [
    r.full_name, r.pronouns, r.email, r.schools?.name, r.year, r.study_area, (r.tracks ?? []).join("; "), (r.skills ?? []).join("; "),
    r.onboarded_at ? "yes" : "no", r.paid_at ? "yes" : "no", teamOf.has(r.id) ? teamName.get(teamOf.get(r.id)!) : "", r.checked_in_at ? "yes" : "no", r.created_at, r.signup_source,
    r.placement_pref === "place_me" ? "Wants placement" : r.placement_pref === "own_team" ? "Picks own team" : "", r.resume_path ? resumeUrl.get(r.resume_path) : "",
  ].map(cell).join(",")));
  // exports of personal data are part of the audit trail
  await supabase.rpc("admin_log_event", { p_action: "export_students", p_details: { filter: f, rows: rows.length } });
  return new NextResponse(lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
