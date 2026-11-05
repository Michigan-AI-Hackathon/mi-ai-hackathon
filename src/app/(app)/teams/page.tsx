import Link from "next/link";
import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { SeatPips, TeamAvatars } from "@/components/Seats";
import ActionButton from "@/components/ActionButton";
import StudentCard from "@/components/StudentCard";
import { DragArea, Drop } from "@/components/DragDrop";
import { requestToJoin } from "@/app/actions";
import { currentFee, TRACKS } from "@/lib/config";
import { requireStudent } from "@/lib/session";
import type { Student } from "@/lib/types";
import { TeamForm } from "../team/TeamForms";

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const { track } = await searchParams;
  const { supabase, profile } = await requireStudent();
  // Students on a team only see their own team.
  const { data: own } = await supabase.from("team_members").select("team_id").eq("user_id", profile.id).maybeSingle();
  if (own) redirect("/team");
  const now = new Date().toISOString();
  let tq = supabase.from("teams").select("id, name, track, needs, created_at").is("locked_at", null).order("created_at", { ascending: false }).limit(100);
  if (track) tq = tq.eq("track", track);
  const [{ data: teams }, { data: mine }, { data: loose }] = await Promise.all([
    tq,
    supabase.from("team_members").select("team_id, teams(name, locked_at)").eq("user_id", profile.id).maybeSingle(),
    supabase.from("student_directory").select("*").is("team_id", null).eq("looking_for_team", true).neq("id", profile.id).order("looking_for_team", { ascending: false }).order("full_name").limit(4),
  ]);
  const myTeamId = mine?.team_id ?? null;
  const myTeam = mine?.teams as unknown as { name: string; locked_at: string | null } | null;
  const myLocked = !!myTeam?.locked_at;
  const canAct = !!profile.paid_at;

  const ids = (teams ?? []).map((t) => t.id);
  const memberIds = myTeamId && !ids.includes(myTeamId) ? [...ids, myTeamId] : ids;
  // Count from team_members (what the "full" check uses). The directory only lists finished, paid profiles.
  const [{ data: rows }, { data: members }, { count: sentCount }] = await Promise.all([
    ids.length ? supabase.from("team_members").select("team_id").in("team_id", ids) : Promise.resolve({ data: [] as { team_id: string }[] }),
    memberIds.length
      ? supabase.from("student_directory").select("id, full_name, school_name, team_id, avatar_url").in("team_id", memberIds)
      : Promise.resolve({ data: [] as Pick<Student, "id" | "full_name" | "school_name" | "team_id" | "avatar_url">[] }),
    myTeamId
      ? supabase.from("invites").select("id", { count: "exact", head: true }).eq("team_id", myTeamId).eq("kind", "invite").eq("status", "pending").gt("expires_at", now)
      : Promise.resolve({ count: 0 }),
  ]);
  const sizes = new Map<string, number>();
  (rows ?? []).forEach((r) => sizes.set(r.team_id, (sizes.get(r.team_id) ?? 0) + 1));
  const byTeam = new Map<string, Pick<Student, "id" | "full_name" | "school_name" | "avatar_url">[]>();
  (members ?? []).forEach((m) => byTeam.set(m.team_id!, [...(byTeam.get(m.team_id!) ?? []), m]));
  const open = (teams ?? []).filter((t) => (sizes.get(t.id) ?? 0) < 4 && t.id !== myTeamId);
  const people = (loose ?? []) as Student[];

  const mySize = myTeamId ? (await supabase.from("team_members").select("user_id", { count: "exact", head: true }).eq("team_id", myTeamId)).count ?? 0 : 0;
  const canInvite = !!myTeamId && !myLocked && canAct && mySize + (sentCount ?? 0) < 4;

  return (
    <DragArea>
      <PageHeader title="Teams" />

      {!canAct && <p className="mt-4 rounded-lg bg-warn/10 px-4 py-3 text-[15px] text-warn">Pay the {currentFee().label} fee on your <Link href="/dashboard" className="underline">dashboard</Link> first.</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {myTeamId ? (
          <Drop accept="person" mode="invite" disabled={!canInvite} className="panel flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-heading text-2xl font-semibold">{myTeam?.name}</p>
              <div className="mt-2"><TeamAvatars people={byTeam.get(myTeamId) ?? []} /></div>
              <div className="mt-1"><SeatPips filled={mySize} /></div>
              <p className="mt-2 text-sm text-muted">{myLocked ? "Locked in." : canInvite ? "Drop a person here to invite." : ""}</p>
            </div>
            <Link href="/team" className="btn-secondary min-h-11">Manage</Link>
          </Drop>
        ) : (
          <>
            <details className="group panel lg:col-span-2" open={false}>
              <summary className="btn-primary w-full cursor-pointer list-none px-6 py-3 text-base sm:w-fit [&::-webkit-details-marker]:hidden">Start a team</summary>
              <div className="mt-5">{canAct ? <TeamForm mode="create" /> : <p className="text-[15px] text-warn">Pay the fee first.</p>}</div>
            </details>
          </>
        )}
      </div>

      <section className="mt-10" aria-labelledby="teams-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="teams-h" className="font-heading text-3xl font-bold">Open teams</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {[["", "All"], ...TRACKS.map((t) => [t, t])].map(([k, l]) => (
              <Link key={k} href={k ? `/teams?track=${encodeURIComponent(k)}` : "/teams"} className={`chip px-3 py-1.5 ${(track ?? "") === k ? "border-ink bg-ink text-card" : ""}`}>{l}</Link>
            ))}
          </div>
        </div>
        {open.length === 0 ? (
          <p className="panel mt-4 text-[15px]">No open teams.</p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {open.map((t) => {
              const m = byTeam.get(t.id) ?? [];
              const n = sizes.get(t.id) ?? 0;
              return (
                <li key={t.id} className="group panel tap-card rise relative flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-heading text-2xl font-semibold"><Link href={`/teams/${t.id}`} className="text-primary underline-offset-4 after:absolute after:inset-0 after:z-0 after:content-[''] group-hover:underline">{t.name}</Link></h3>
                      {t.track && <span className="chip mt-2 w-fit">{t.track}</span>}
                    </div>
                    <span className="mt-1 text-sm font-medium text-muted">{n}/4</span>
                  </div>
                  <TeamAvatars people={m} />
                  {m.length > 0 && <p className="truncate text-sm text-muted">{m.map((x) => x.full_name.split(" ")[0]).join(", ")}</p>}
                  {t.needs && <p className="line-clamp-2 text-[15px]"><span className="font-semibold">Looking for:</span> {t.needs}</p>}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="relative z-10">{!myTeamId && canAct && <ActionButton action={requestToJoin.bind(null, t.id)}>Ask to join</ActionButton>}</div>
                    <span aria-hidden className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-md border border-line px-3 text-sm font-semibold text-primary transition-colors group-hover:border-primary group-hover:bg-primary/5">View team <span className="transition-transform group-hover:translate-x-0.5">›</span></span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12 scroll-mt-24" id="teammates" aria-labelledby="mates-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="mates-h" className="font-heading text-3xl font-bold">Looking for a team</h2>
          <Link href="/people" className="btn-secondary">Find</Link>
        </div>
        {people.length === 0 ? (
          <p className="panel mt-4 text-[15px]">Nobody yet.</p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {people.map((s) => <StudentCard key={s.id} s={s} myTeamId={myTeamId} myTeamLocked={myLocked} canAct={canAct} draggable={canInvite} />)}
          </ul>
        )}
        {people.length > 0 && <p className="mt-4"><Link href="/people" className="font-medium text-primary hover:underline">See all →</Link></p>}
      </section>
    </DragArea>
  );
}
