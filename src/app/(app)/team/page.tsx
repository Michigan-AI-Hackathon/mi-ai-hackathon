import Link from "next/link";
import ActionButton from "@/components/ActionButton";
import { cancelInvite, leaveTeam, lockTeam, respondInvite } from "@/app/actions";
import { EVENT } from "@/lib/config";
import { requireStudent } from "@/lib/session";
import { timeLeft } from "@/lib/time";
import type { Student } from "@/lib/types";
import { TeamForm } from "./TeamForms";

export default async function TeamPage() {
  const { supabase, profile } = await requireStudent();
  const { data: membership } = await supabase.from("team_members").select("team_id").eq("user_id", profile.id).maybeSingle();

  if (!membership) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-heading text-4xl font-bold">My team</h1>
        <p className="mt-2 text-[16px] text-muted">You&apos;re not on a team yet. Start one and invite people, or ask to join a team that has open spots.</p>
        {profile.paid_at ? (
          <section className="panel mt-6">
            <h2 className="mb-4 font-heading text-xl font-semibold">Start a team</h2>
            <TeamForm mode="create" />
          </section>
        ) : (
          <p className="mt-6 rounded-lg bg-warn/10 px-4 py-3 text-[15px] text-warn">Pay the {EVENT.feeLabel} registration fee from your <Link href="/dashboard" className="underline">dashboard</Link> to start or join a team.</p>
        )}
        <p className="mt-6 text-[15px]">Or <Link href="/teams" className="font-medium text-primary hover:underline">browse open teams</Link>, and check your <Link href="/invites" className="font-medium text-primary hover:underline">invites</Link>.</p>
      </div>
    );
  }

  const teamId = membership.team_id;
  const now = new Date().toISOString();
  const [{ data: team }, { data: members }, { data: invites }, { data: problem }, { data: conv }] = await Promise.all([
    supabase.from("teams").select("*").eq("id", teamId).single(),
    supabase.from("student_directory").select("*").eq("team_id", teamId),
    supabase.from("invites").select("id, kind, student_id, expires_at").eq("team_id", teamId).eq("status", "pending").gt("expires_at", now),
    supabase.rpc("team_lock_problem", { p_team: teamId }),
    supabase.from("conversations").select("id").eq("team_id", teamId).maybeSingle(),
  ]);
  const list = (members ?? []) as Student[];
  // names come from the directory (other students' profiles aren't readable directly)
  const ids = (invites ?? []).map((i) => i.student_id);
  const { data: invitees } = ids.length ? await supabase.from("student_directory").select("id, full_name, school_name").in("id", ids) : { data: [] };
  const nameOf = (id: string) => invitees?.find((x) => x.id === id);
  const sent = (invites ?? []).filter((i) => i.kind === "invite");
  const requests = (invites ?? []).filter((i) => i.kind === "request");
  const schools = new Set(list.map((m) => m.school_group)).size;
  const locked = !!team?.locked_at;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-8">
        <div>
          <h1 className="font-heading text-4xl font-bold">{team?.name}</h1>
          <p className="mt-2 text-[16px] text-muted">
            {team?.track ?? "Track not decided"}, {list.length} of 4 people from {schools} {schools === 1 ? "school" : "schools"}
            {locked && <span className="ml-2 font-semibold text-ok">Locked in</span>}
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Team spots">
          {[0, 1, 2, 3].map((i) => {
            const m = list[i];
            return m ? (
              <li key={m.id} className="panel">
                <Link href={`/people/${m.id}`} className="font-heading text-lg font-semibold hover:text-primary">{m.full_name}{m.id === profile.id && " (you)"}</Link>
                <p className="text-[15px] text-muted">{m.school_name}</p>
                <p className="mt-1 text-sm text-muted">{m.study_area}</p>
              </li>
            ) : (
              <li key={i} className="flex min-h-28 items-center justify-center rounded-xl border-2 border-dashed border-line p-5 text-[15px] text-muted">
                {locked ? "Empty" : <Link href="/people?status=no-team&others=1" className="font-medium text-primary hover:underline">Find someone for this spot</Link>}
              </li>
            );
          })}
        </ul>

        {requests.length > 0 && !locked && (
          <section className="panel">
            <h2 className="font-heading text-xl font-semibold">Asking to join</h2>
            <ul className="mt-3 divide-y divide-line">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span><Link href={`/people/${r.student_id}`} className="font-semibold hover:text-primary">{nameOf(r.student_id)?.full_name ?? "A student"}</Link>
                    <span className="text-muted">, {nameOf(r.student_id)?.school_name}. {timeLeft(r.expires_at)}</span></span>
                  <span className="flex gap-2">
                    <ActionButton action={respondInvite.bind(null, r.id, true)}>Accept</ActionButton>
                    <ActionButton action={respondInvite.bind(null, r.id, false)} variant="secondary">Decline</ActionButton>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sent.length > 0 && !locked && (
          <section className="panel">
            <h2 className="font-heading text-xl font-semibold">Invites waiting for an answer</h2>
            <ul className="mt-3 divide-y divide-line">
              {sent.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span><span className="font-semibold">{nameOf(r.student_id)?.full_name ?? "A student"}</span>
                    <span className="text-muted">, {timeLeft(r.expires_at)}</span></span>
                  <ActionButton action={cancelInvite.bind(null, r.id)} variant="secondary">Cancel invite</ActionButton>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!locked && (
          <section className="panel">
            <h2 className="mb-4 font-heading text-xl font-semibold">Team details</h2>
            <TeamForm mode="edit" initial={{ name: team!.name, track: team!.track, needs: team!.needs }} />
          </section>
        )}
      </div>

      <aside className="space-y-4">
        {conv && <Link href={`/messages/${conv.id}`} className="btn-primary w-full py-3">Open team chat</Link>}
        <div className="panel">
          <h2 className="font-heading text-lg font-semibold">{locked ? "You're locked in" : "Lock in your team"}</h2>
          {locked ? (
            <p className="mt-2 text-[15px] text-muted">Your spot is guaranteed. To change members, email an organizer.</p>
          ) : (
            <>
              <p className="mt-2 text-[15px] text-muted">Locked teams are guaranteed a spot. After you lock in, nobody can join or leave.</p>
              {problem ? (
                <p className="mt-3 text-[15px] text-warn">{problem as string}</p>
              ) : (
                <div className="mt-3"><ActionButton action={lockTeam} confirm="Lock in your team? Nobody can join or leave after this.">Lock in team</ActionButton></div>
              )}
            </>
          )}
        </div>
        <div className="panel text-[15px]">
          <h2 className="font-heading text-lg font-semibold">Team rules</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>Up to 4 people</li>
            <li>No more than 2 from the same school</li>
            <li>A team of 4 needs at least 3 schools</li>
            <li>A team of 3 needs 3 different schools</li>
            <li>Everyone pays the registration fee before locking in</li>
          </ul>
        </div>
        {!locked && <ActionButton action={leaveTeam} variant="danger" confirm="Leave this team?">Leave team</ActionButton>}
      </aside>
    </div>
  );
}
