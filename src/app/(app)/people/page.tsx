import Link from "next/link";
import StudentCard from "@/components/StudentCard";
import { EVENT, SKILL_SUGGESTIONS, TRACKS } from "@/lib/config";
import { requireStudent } from "@/lib/session";
import type { Student } from "@/lib/types";

type SP = { q?: string; track?: string; skill?: string; school?: string; status?: string; others?: string };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireStudent();

  const [{ data: me }, { data: schools }, { data: myMembership }] = await Promise.all([
    supabase.from("student_directory").select("school_group").eq("id", profile.id).maybeSingle(),
    supabase.from("schools").select("id, name").order("name"),
    supabase.from("team_members").select("team_id, teams(locked_at)").eq("user_id", profile.id).maybeSingle(),
  ]);
  const myTeamId = myMembership?.team_id ?? null;
  const myTeamLocked = !!(myMembership?.teams as unknown as { locked_at: string | null } | null)?.locked_at;

  let query = supabase.from("student_directory").select("*").neq("id", profile.id).order("full_name").limit(60);
  const q = (sp.q ?? "").replace(/[,()%*\\.]/g, " ").trim();
  if (q) query = query.or(`full_name.ilike.%${q}%,study_area.ilike.%${q}%,bio.ilike.%${q}%`);
  if (sp.track) query = query.contains("tracks", [sp.track]);
  if (sp.skill) query = query.contains("skills", [sp.skill]);
  if (sp.school) query = query.eq("school_id", Number(sp.school));
  if (sp.status === "no-team") query = query.is("team_id", null);
  if (sp.status === "looking") query = query.is("team_id", null).eq("looking_for_team", true);
  if (sp.others && me?.school_group) query = query.neq("school_group", me.school_group);
  const { data: students } = await query;
  const list = (students ?? []) as Student[];
  const canAct = !!profile.paid_at;

  return (
    <div>
      <h1 className="font-heading text-4xl font-bold">Find teammates</h1>
      <p className="mt-2 text-[16px] text-muted">Search students from every school. Invite someone to your team, ask to join theirs, or send a message.</p>
      {!canAct && <p className="mt-4 rounded-lg bg-warn/10 px-4 py-3 text-[15px] text-warn">Pay the {EVENT.feeLabel} registration fee from your dashboard to invite or message people.</p>}

      <form className="panel mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Name, major or keyword" />
        </div>
        <div>
          <label htmlFor="track" className="label">Track</label>
          <select id="track" name="track" defaultValue={sp.track ?? ""} className="input">
            <option value="">Any</option>{TRACKS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="skill" className="label">Skill</label>
          <select id="skill" name="skill" defaultValue={sp.skill ?? ""} className="input">
            <option value="">Any</option>{SKILL_SUGGESTIONS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="school" className="label">School</label>
          <select id="school" name="school" defaultValue={sp.school ?? ""} className="input">
            <option value="">Any</option>{(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="label">Team status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="input">
            <option value="">Everyone</option>
            <option value="no-team">No team yet</option>
            <option value="looking">Looking for a team</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-[15px] sm:col-span-2 lg:col-span-4">
          <input type="checkbox" name="others" value="1" defaultChecked={!!sp.others} className="h-4 w-4 accent-primary" />
          Only show students from other schools
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:justify-end">
          <Link href="/people" className="btn-secondary">Clear</Link>
          <button className="btn-primary">Search</button>
        </div>
      </form>

      <p className="mt-6 text-sm text-muted" aria-live="polite">{list.length === 60 ? "Showing the first 60 matches. Narrow your search to see more." : `${list.length} ${list.length === 1 ? "student" : "students"}`}</p>
      {list.length === 0 ? (
        <div className="panel mt-3 text-[15px]">No students match those filters. Try removing one.</div>
      ) : (
        <ul className="mt-3 grid gap-4 md:grid-cols-2">
          {list.map((s) => <StudentCard key={s.id} s={s} myTeamId={myTeamId} myTeamLocked={myTeamLocked} canAct={canAct} />)}
        </ul>
      )}
    </div>
  );
}
