import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import StudentActions from "@/components/StudentActions";
import { requireStudent } from "@/lib/session";
import type { Student } from "@/lib/types";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireStudent();
  const { data } = await supabase.from("student_directory").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const s = data as Student;
  const { data: mine } = await supabase.from("team_members").select("team_id, teams(locked_at)").eq("user_id", profile.id).maybeSingle();
  const isMe = s.id === profile.id;

  return (
    <div className="max-w-3xl">
      <Link href="/people" className="text-sm font-medium text-primary hover:underline">Back to search</Link>
      <div className="mt-4 flex items-center gap-4"><Avatar url={s.avatar_url} name={s.full_name} size={72} /><h1 className="font-heading text-4xl font-bold">{s.full_name}</h1></div>
      <p className="mt-1 text-lg text-muted">{s.school_name}{s.study_area ? `, ${s.study_area}` : ""}</p>
      <p className="mt-2 text-[15px]">{s.team_id ? <>On team <strong>{s.team_name}</strong></> : s.looking_for_team ? "Looking for a team" : "No team yet"}</p>

      {!isMe && (
        <div className="mt-6">
          <StudentActions studentId={s.id} theirTeamId={s.team_id} myTeamId={mine?.team_id ?? null}
            myTeamLocked={!!(mine?.teams as unknown as { locked_at: string | null } | null)?.locked_at} canAct={!!profile.paid_at} />
        </div>
      )}

      <dl className="panel mt-8 space-y-5">
        {s.bio && <div><dt className="label">What they&apos;re looking for</dt><dd className="text-[16px] leading-relaxed">{s.bio}</dd></div>}
        <div><dt className="label">Tracks</dt><dd className="flex flex-wrap gap-1.5">{s.tracks.map((t) => <span key={t} className="chip">{t}</span>)}</dd></div>
        {s.skills.length > 0 && <div><dt className="label">Skills</dt><dd className="flex flex-wrap gap-1.5">{s.skills.map((t) => <span key={t} className="chip">{t}</span>)}</dd></div>}
        {s.interests.length > 0 && <div><dt className="label">Interests</dt><dd className="flex flex-wrap gap-1.5">{s.interests.map((t) => <span key={t} className="chip">{t}</span>)}</dd></div>}
        {s.linkedin_url && <div><dt className="label">LinkedIn</dt><dd><a href={s.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View LinkedIn profile</a></dd></div>}
      </dl>
    </div>
  );
}
