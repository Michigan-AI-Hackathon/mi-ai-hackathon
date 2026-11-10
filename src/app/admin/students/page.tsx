import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Avatar from "@/components/Avatar";
import StudentActions, { type TeamOption } from "@/components/admin/StudentActions";
import { requireAdmin } from "@/lib/admin";

type Row = {
  id: string; full_name: string | null; email: string; year: string | null; study_area: string | null; avatar_url: string | null;
  onboarded_at: string | null; paid_at: string | null; checked_in_at: string | null; pronouns: string | null; resume_path: string | null; placement_pref: string | null; created_at: string; schools: { name: string } | null;
};
const FILTERS = [["all", "Everyone"], ["unpaid", "Not paid"], ["paid", "Paid"], ["solo", "Paid, no team"], ["team", "On a team"], ["incomplete", "Profile unfinished"], ["checked", "Checked in"]] as const;

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const f = FILTERS.some(([k]) => k === sp.f) ? sp.f! : "all";
  const q = (sp.q ?? "").replace(/[,()%*\\.]/g, " ").trim().slice(0, 60);

  let query = supabase.from("profiles").select("id, full_name, email, year, study_area, avatar_url, onboarded_at, paid_at, checked_in_at, pronouns, resume_path, placement_pref, created_at, schools(name)").order("created_at", { ascending: false }).limit(300);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  if (f === "unpaid") query = query.is("paid_at", null);
  if (f === "incomplete") query = query.is("onboarded_at", null);
  const [{ data }, { data: members }, { data: teams }] = await Promise.all([query, supabase.from("team_members").select("team_id, user_id"), supabase.from("teams").select("id, name, locked_at")]);
  const teamOf = new Map((members ?? []).map((m) => [m.user_id as string, m.team_id as string]));
  const teamName = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));
  const size = new Map<string, number>(); (members ?? []).forEach((m) => size.set(m.team_id, (size.get(m.team_id) ?? 0) + 1));
  const options: TeamOption[] = (teams ?? []).filter((t) => !t.locked_at && (size.get(t.id) ?? 0) < 4).map((t) => ({ id: t.id, name: t.name, open: 4 - (size.get(t.id) ?? 0) }));

  let rows = (data ?? []) as unknown as Row[];
  if (f === "paid") rows = rows.filter((r) => r.paid_at);
  if (f === "solo") rows = rows.filter((r) => r.paid_at && r.onboarded_at && !teamOf.has(r.id));
  if (f === "team") rows = rows.filter((r) => teamOf.has(r.id));
  if (f === "checked") rows = rows.filter((r) => r.checked_in_at);

  // Resumes are private: sign short-lived links with the organizer's own session (storage policy allows organizers only).
  const resumeUrl = new Map<string, string>();
  const paths = rows.map((r) => r.resume_path).filter((x): x is string => !!x);
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("resumes").createSignedUrls(paths, 3600);
    (signed ?? []).forEach((x) => { if (x.path && x.signedUrl) resumeUrl.set(x.path, x.signedUrl); });
  }

  return (
    <div>
      <PageHeader eyebrow="Students" title="Everyone who signed up">Search by name or email. Year and email are visible to organizers only.</PageHeader>
      <form className="panel flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-60 flex-1"><label htmlFor="q" className="label">Search</label><input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Name or email" /></div>
        <div><label htmlFor="f" className="label">Show</label><select id="f" name="f" defaultValue={f} className="input">{FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <button className="btn-primary">Search</button>
        <Link href="/admin/students" className="btn-secondary">Clear</Link>
        <a href={`/admin/students.csv?f=${f}&q=${encodeURIComponent(q)}`} className="btn-secondary ml-auto">Download CSV</a>
      </form>
      <p className="mt-5 text-sm text-muted" aria-live="polite">{rows.length}{rows.length === 300 ? "+" : ""} {rows.length === 1 ? "student" : "students"}</p>

      <ul className="mt-3 space-y-3">
        {rows.map((r) => {
          const tid = teamOf.get(r.id) ?? null;
          return (
            <li key={r.id} className="panel space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar url={r.avatar_url} name={r.full_name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-lg font-semibold">{r.full_name ?? <span className="text-muted">No name yet</span>}{r.pronouns && <span className="ml-2 text-sm font-normal text-muted">({r.pronouns})</span>}</p>
                  <p className="truncate text-[14px] text-muted">{r.email} · {r.schools?.name ?? "No school"}{r.year ? ` · ${r.year}` : ""}{r.study_area ? ` · ${r.study_area}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[13px] font-medium">
                  <span className={`chip ${r.onboarded_at ? "" : "border-warn text-warn"}`}>{r.onboarded_at ? "Profile done" : "Profile unfinished"}</span>
                  <span className={`chip ${r.paid_at ? "border-ok text-ok" : "border-warn text-warn"}`}>{r.paid_at ? "Paid" : "Not paid"}</span>
                  <span className="chip">{tid ? `Team: ${teamName.get(tid)}` : "No team"}</span>
                  {r.placement_pref === "place_me" && <span className="chip border-primary text-primary">Wants placement</span>}
                  {r.placement_pref === "own_team" && <span className="chip">Picking own team</span>}
                  {r.resume_path && resumeUrl.get(r.resume_path) && <a href={resumeUrl.get(r.resume_path)} target="_blank" rel="noopener noreferrer" className="chip border-primary text-primary hover:underline">Resume</a>}
                  {r.checked_in_at && <span className="chip border-ink bg-ink text-card">Checked in</span>}
                </div>
              </div>
              <StudentActions id={r.id} paid={!!r.paid_at} checkedIn={!!r.checked_in_at} teamId={tid} teams={options} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
