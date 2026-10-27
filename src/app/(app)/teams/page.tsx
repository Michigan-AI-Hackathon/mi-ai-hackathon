import Link from "next/link";
import ActionButton from "@/components/ActionButton";
import { requestToJoin } from "@/app/actions";
import { requireStudent } from "@/lib/session";
import type { Student } from "@/lib/types";

export default async function OpenTeamsPage({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const { track } = await searchParams;
  const { supabase, profile } = await requireStudent();
  let tq = supabase.from("teams").select("id, name, track, needs, created_at").is("locked_at", null).order("created_at", { ascending: false }).limit(100);
  if (track) tq = tq.eq("track", track);
  const [{ data: teams }, { data: mine }] = await Promise.all([
    tq, supabase.from("team_members").select("team_id").eq("user_id", profile.id).maybeSingle(),
  ]);
  const ids = (teams ?? []).map((t) => t.id);
  // Count from team_members (what the "full" check uses). The directory only lists finished, paid profiles.
  const { data: rows } = ids.length ? await supabase.from("team_members").select("team_id").in("team_id", ids) : { data: [] };
  const sizes = new Map<string, number>();
  (rows ?? []).forEach((r) => sizes.set(r.team_id, (sizes.get(r.team_id) ?? 0) + 1));
  const { data: members } = ids.length
    ? await supabase.from("student_directory").select("id, full_name, school_name, team_id").in("team_id", ids)
    : { data: [] as Pick<Student, "id" | "full_name" | "school_name" | "team_id">[] };
  const byTeam = new Map<string, Pick<Student, "id" | "full_name" | "school_name">[]>();
  (members ?? []).forEach((m) => byTeam.set(m.team_id!, [...(byTeam.get(m.team_id!) ?? []), m]));
  const open = (teams ?? []).filter((t) => (sizes.get(t.id) ?? 0) < 4);

  return (
    <div>
      <h1 className="font-heading text-4xl font-bold">Open teams</h1>
      <p className="mt-2 text-[16px] text-muted">Teams with open spots. Ask to join one, and a member will accept or decline.</p>
      {mine && <p className="mt-4 rounded-lg bg-paper px-4 py-3 text-[15px] ring-1 ring-line">You&apos;re already on a team. <Link href="/team" className="font-medium text-primary hover:underline">Go to your team</Link></p>}
      {open.length === 0 ? (
        <div className="panel mt-6 text-[15px]">No open teams yet. <Link href="/team" className="font-medium text-primary hover:underline">Start one</Link> and invite people.</div>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {open.map((t) => {
            const m = byTeam.get(t.id) ?? [];
            return (
              <li key={t.id} className="panel flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-heading text-xl font-semibold">{t.name}</h2>
                  <span className="text-sm text-muted">{sizes.get(t.id) ?? 0} of 4</span>
                </div>
                {t.track && <span className="chip w-fit">{t.track}</span>}
                {t.needs && <p className="text-[15px]"><span className="font-semibold">Looking for:</span> {t.needs}</p>}
                <ul className="text-[15px] text-muted">
                  {m.map((x) => <li key={x.id}><Link href={`/people/${x.id}`} className="text-ink hover:text-primary">{x.full_name}</Link>, {x.school_name}</li>)}
                </ul>
                {!mine && profile.paid_at && <div className="mt-auto"><ActionButton action={requestToJoin.bind(null, t.id)}>Ask to join</ActionButton></div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
