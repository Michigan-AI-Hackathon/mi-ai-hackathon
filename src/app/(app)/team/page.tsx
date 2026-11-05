import Link from "next/link";
import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import { SeatPips } from "@/components/Seats";
import ActionButton from "@/components/ActionButton";
import { cancelInvite, leaveTeam, lockTeam, respondInvite } from "@/app/actions";
import { LOCK_DEADLINE_LABEL } from "@/lib/config";
import { requireStudent } from "@/lib/session";
import { timeLeft } from "@/lib/time";
import type { Student } from "@/lib/types";
import { TeamForm } from "./TeamForms";

export default async function TeamPage() {
  const { supabase, profile } = await requireStudent();
  const { data: membership } = await supabase.from("team_members").select("team_id").eq("user_id", profile.id).maybeSingle();

  if (!membership) redirect("/teams");

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
        <div className="rise">
          <p className="eyebrow text-primary">{team?.track}{locked && <span className="ml-3 rounded-full bg-ink px-2.5 py-1 text-[11px] text-card">Locked in</span>}</p>
          <h1 className="mt-2 font-heading text-4xl font-bold sm:text-6xl">{team?.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[15px] text-muted">
            <SeatPips filled={list.length} />
            <span>{list.length}/4 · {schools} {schools === 1 ? "school" : "schools"}</span>
          </div>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Team spots">
          {[0, 1, 2, 3].map((i) => {
            const m = list[i];
            return m ? (
              <li key={m.id} data-tap="" className={`group panel tap-card rise relative ${m.id === profile.id ? "border-ink" : ""}`} style={{ "--i": i + 1 } as React.CSSProperties}>
                <div className="flex items-center gap-3">
                  <Avatar url={m.avatar_url} name={m.full_name} size={44} />
                  <div className="min-w-0">
                    <Link href={`/people/${m.id}`} className="font-heading text-lg font-semibold text-primary underline-offset-4 after:absolute after:inset-0 after:content-[''] group-hover:underline">{m.full_name}{m.id === profile.id && " (you)"}</Link>
                    <p className="text-[15px] text-muted">{m.school_name}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-muted"><span>{m.study_area}</span><span aria-hidden className="inline-flex min-h-11 items-center gap-1 rounded-md border border-line px-3 font-semibold text-primary transition-colors group-hover:border-primary group-hover:bg-primary/5">View profile ›</span></div>
              </li>
            ) : (
              <li key={i} className="rise" style={{ "--i": i + 1 } as React.CSSProperties}>
                {locked ? <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-line text-[15px] text-muted">Empty</div> : (
                  <Link href="/people" className="group grid min-h-36 place-content-center justify-items-center gap-2 rounded-xl border border-dashed border-ink/30 p-5 text-[15px] text-muted transition-all duration-300 hover:border-ink hover:bg-card hover:text-ink">
                    <span className="grid h-10 w-10 place-items-center rounded-full border border-current text-xl transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:rotate-90">+</span>
                    <span className="font-medium">Invite</span>
                  </Link>
                )}
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
                  <span><Link href={`/people/${r.student_id}`} className="font-semibold text-primary hover:underline">{nameOf(r.student_id)?.full_name ?? "A student"}</Link>
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
            <h2 className="font-heading text-xl font-semibold">Pending invites</h2>
            <ul className="mt-3 divide-y divide-line">
              {sent.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span><Link href={`/people/${r.student_id}`} className="font-semibold text-primary hover:underline">{nameOf(r.student_id)?.full_name ?? "A student"}</Link>
                    <span className="text-muted">, {timeLeft(r.expires_at)}</span></span>
                  <ActionButton action={cancelInvite.bind(null, r.id)} variant="secondary">Cancel</ActionButton>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!locked && (
          <section className="panel">
            <h2 className="mb-4 font-heading text-xl font-semibold">Details</h2>
            <TeamForm mode="edit" initial={{ name: team!.name, track: team!.track, needs: team!.needs }} />
          </section>
        )}
      </div>

      <aside className="space-y-4">
        {conv && <Link href={`/messages/${conv.id}`} className="btn-primary w-full py-3">Team chat</Link>}
        <div className="panel">
          <h2 className="font-heading text-lg font-semibold">{locked ? "You're locked in" : "Lock in your team"}</h2>
          {locked ? (
            <p className="mt-2 text-[15px] text-muted">To change members, email an organizer.</p>
          ) : (
            <>
              <p className="mt-2 text-sm font-medium text-ink">Deadline: {LOCK_DEADLINE_LABEL.toLowerCase()}</p>
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
            <li>4 people per team</li>
            <li>No more than 2 from the same school</li>
            <li>A team of 4 needs at least 3 schools</li>
            <li>Every campus counts as its own school</li>
          </ul>
        </div>
        {!locked && <ActionButton action={leaveTeam} variant="danger" confirm="Leave this team?">Leave team</ActionButton>}
      </aside>
    </div>
  );
}
