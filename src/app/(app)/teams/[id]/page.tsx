import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import ActionButton from "@/components/ActionButton";
import { SeatPips } from "@/components/Seats";
import { requestToJoin } from "@/app/actions";
import { requireStudent } from "@/lib/session";
import type { Student } from "@/lib/types";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireStudent();
  const [{ data: team }, { data: dir }, { count }, { data: mine }] = await Promise.all([
    supabase.from("teams").select("id, name, track, needs, locked_at").eq("id", id).maybeSingle(),
    supabase.from("student_directory").select("*").eq("team_id", id).order("full_name"),
    supabase.from("team_members").select("user_id", { count: "exact", head: true }).eq("team_id", id),
    supabase.from("team_members").select("team_id").eq("user_id", profile.id).maybeSingle(),
  ]);
  if (mine) redirect("/team");
  if (!team) notFound();
  const members = (dir ?? []) as Student[];
  const seats = Math.max(count ?? 0, members.length);
  const schools = [...members.reduce((m, s) => m.set(s.school_name, (m.get(s.school_name) ?? 0) + 1), new Map<string, number>())];
  const tracks = new Set<string>([...(team.track ? [team.track] : []), ...members.flatMap((m) => m.tracks)]);

  const blocked = team.locked_at ? "This team is locked."
    : seats >= 4 ? "This team is full."
    : !profile.paid_at ? "Pay the registration fee on your dashboard first."
    : null;

  return (
    <div className="max-w-3xl max-md:pb-28">
      <Link href="/teams" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">← Teams</Link>
      <h1 className="mt-3 font-heading text-3xl font-bold sm:text-5xl">{team.name}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SeatPips filled={seats} />
        <span className="text-sm font-medium text-muted">{seats}/4</span>
        {[...tracks].map((t) => <span key={t} className="chip border-primary/30 bg-primary/5 font-medium">{t}</span>)}
      </div>

      <dl className="panel mt-6 space-y-5">
        {team.needs && <div><dt className="label">Looking for</dt><dd className="mt-1 text-[16px] leading-relaxed">{team.needs}</dd></div>}
        {schools.length > 0 && (
          <div><dt className="label">Schools</dt><dd className="mt-1 flex flex-wrap gap-1.5">{schools.map(([n, c]) => <span key={n} className="chip">{n}{c > 1 ? ` x${c}` : ""}</span>)}</dd></div>
        )}
      </dl>

      <h2 className="mt-8 font-heading text-2xl font-bold">Members</h2>
      {members.length === 0 ? <p className="panel mt-3 text-[15px]">No visible members yet.</p> : (
        <ul className="mt-3 grid gap-4 md:grid-cols-2">
          {members.map((s) => {
            const linkedin = s.linkedin_url && /^https?:\/\//i.test(s.linkedin_url) ? s.linkedin_url : null;
            return (
              <li key={s.id} className="group panel tap-card rise relative flex flex-col gap-3">
                <div className="flex gap-3">
                  <Avatar url={s.avatar_url} name={s.full_name} size={48} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/people/${s.id}`} className="font-heading text-xl font-semibold text-primary underline-offset-4 after:absolute after:inset-0 after:z-0 after:content-[''] group-hover:underline">{s.full_name}</Link>
                    <p className="mt-0.5 text-[15px] text-muted">{s.school_name}{s.study_area ? `, ${s.study_area}` : ""}</p>
                  </div>
                  <span aria-hidden className="self-center text-primary">›</span>
                </div>
                {s.skills.length > 0 && <div className="flex flex-wrap gap-1.5">{s.skills.slice(0, 6).map((k) => <span key={k} className="chip">{k}</span>)}</div>}
                {linkedin && <a href={linkedin} target="_blank" rel="noopener noreferrer" className="relative z-10 inline-flex min-h-11 w-fit items-center text-sm font-medium text-primary hover:underline">LinkedIn ↗</a>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8 max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] max-md:z-30 max-md:mt-0 max-md:border-t max-md:border-line max-md:bg-card/95 max-md:px-4 max-md:py-3 max-md:backdrop-blur-md">
        {blocked ? <p className="text-[15px] text-muted">{blocked}</p>
          : <ActionButton action={requestToJoin.bind(null, team.id)}>Ask to join</ActionButton>}
      </div>
    </div>
  );
}
