import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import StudentActions from "@/components/StudentActions";
import { requireStudent } from "@/lib/session";
import type { Student } from "@/lib/types";

function Chips({ label, items, strong }: { label: string; items: string[]; strong?: boolean }) {
  if (!items.length) return null;
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-1 flex flex-wrap gap-1.5">{items.map((t) => <span key={t} className={strong ? "chip border-primary/30 bg-primary/5 font-medium" : "chip"}>{t}</span>)}</dd>
    </div>
  );
}

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireStudent();
  const { data } = await supabase.from("student_directory").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const s = data as Student;
  const { data: mine } = await supabase.from("team_members").select("team_id, teams(locked_at)").eq("user_id", profile.id).maybeSingle();
  const isMe = s.id === profile.id;
  const status = s.team_id ? `On team ${s.team_name}` : s.looking_for_team ? "Looking for a team" : "No team yet";
  const linkedin = s.linkedin_url && /^https?:\/\//i.test(s.linkedin_url) ? s.linkedin_url : null;

  return (
    <div className="max-w-3xl max-md:pb-24">
      <Link href="/people" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">← Find teammates</Link>
      <div className="mt-5 flex items-center gap-4 sm:gap-5">
        <Avatar url={s.avatar_url} name={s.full_name} size={80} />
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold sm:text-5xl">{s.full_name}{s.pronouns && <span className="ml-3 align-middle text-lg font-normal text-muted">{s.pronouns}</span>}</h1>
          <p className="mt-1 text-lg text-muted">{s.school_name}</p>
          <p className={`mt-1 text-[15px] font-medium ${s.team_id ? "text-muted" : "text-ok"}`}>{status}</p>
        </div>
      </div>

      <div className="mt-6 max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] max-md:z-30 max-md:mt-0 max-md:border-t max-md:border-line max-md:bg-card/95 max-md:px-4 max-md:py-3 max-md:backdrop-blur-md">
        {isMe ? (
          <Link href="/onboarding" className="btn-secondary">Edit my profile</Link>
        ) : (
          <StudentActions studentId={s.id} theirTeamId={s.team_id} myTeamId={mine?.team_id ?? null}
            myTeamLocked={!!(mine?.teams as unknown as { locked_at: string | null } | null)?.locked_at} canAct={!!profile.paid_at} />
        )}
        {!isMe && !profile.paid_at && <p className="mt-2 text-[15px] text-warn">Pay the registration fee on your dashboard first.</p>}
      </div>

      <dl className="panel mt-8 space-y-6">
        {s.bio && <div><dt className="label">About</dt><dd className="mt-1 text-[16px] leading-relaxed">{s.bio}</dd></div>}
        {(s.study_area || s.year) && (
          <div><dt className="label">Studying</dt><dd className="mt-1">{[s.study_area, s.year].filter(Boolean).join(", ")}</dd></div>
        )}
        <Chips label="Tracks" items={s.tracks} strong />
        <Chips label="Skills" items={s.skills} />
        <Chips label="Interests" items={s.interests} />
        {linkedin && (
          <div><a href={linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 rounded-lg bg-[#0A66C2] px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#004182]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.12 2.06 2.06 0 010 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>
            LinkedIn
          </a></div>
        )}
      </dl>
    </div>
  );
}
