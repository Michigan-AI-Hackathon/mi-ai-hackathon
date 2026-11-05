import MatchingBoard from "@/components/admin/MatchingBoard";
import PageHeader from "@/components/PageHeader";
import { requireAdmin } from "@/lib/admin";
import { DEFAULT_SETTINGS, type Person, type Settings, type Team } from "@/lib/matching";

type Prof = { id: string; full_name: string | null; school_id: number | null; tracks: string[] | null; skills: string[] | null; onboarded_at: string | null; paid_at: string | null; checked_in_at: string | null };

export default async function MatchingPage() {
  const { supabase } = await requireAdmin();
  const [{ data: profs }, { data: tm }, { data: teams }, { data: schools }, { data: app }, { data: cfg }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, school_id, tracks, skills, onboarded_at, paid_at, checked_in_at").limit(5000),
    supabase.from("team_members").select("team_id, user_id"),
    supabase.from("teams").select("id, name, track, locked_at").limit(1000),
    supabase.from("schools").select("id, name, rule_group"),
    supabase.from("app_settings").select("require_payment").limit(1),
    supabase.rpc("admin_matching_settings"),
  ]);
  const needPay = (app?.[0]?.require_payment as boolean | undefined) ?? true;
  const school = new Map((schools ?? []).map((s) => [s.id as number, s as { id: number; name: string; rule_group: string | null }]));
  const teamOf = new Map((tm ?? []).map((m) => [m.user_id as string, m.team_id as string]));
  const people: Person[] = ((profs ?? []) as Prof[]).filter((p) => p.school_id != null).map((p) => {
    const s = school.get(p.school_id!);
    return {
      id: p.id, name: p.full_name ?? "No name", schoolId: p.school_id!, school: s?.name ?? "Unknown school", group: s?.rule_group ?? `school-${p.school_id}`,
      tracks: p.tracks ?? [], skills: p.skills ?? [], checkedIn: !!p.checked_in_at,
      ready: !!p.onboarded_at && (!needPay || !!p.paid_at), teamId: teamOf.get(p.id) ?? null,
    };
  });
  const c = cfg as { target_team_size: number; allow_force_school_mix: boolean; track_weight: number } | null;
  const settings: Settings = c ? { teamSize: c.target_team_size, allowForce: c.allow_force_school_mix, trackWeight: Number(c.track_weight) } : DEFAULT_SETTINGS;
  const teamList: Team[] = (teams ?? []).map((t) => ({ id: t.id as string, name: t.name as string, track: (t.track as string | null) ?? null, locked: !!t.locked_at }));
  const used = new Set(people.map((p) => p.schoolId));
  const campuses = [...school.values()].filter((s) => used.has(s.id)).sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ id: s.id, name: s.name }));

  return (
    <div>
      <PageHeader eyebrow="Matching" title="Fill and form teams">See who needs a team, get suggestions, review each change, then apply. Nothing changes until you press Apply.</PageHeader>
      <MatchingBoard people={people} teams={teamList} schools={campuses} initial={settings} />
    </div>
  );
}
