import Link from "next/link";
import ActionButton from "@/components/ActionButton";
import { cancelInvite, respondInvite } from "@/app/actions";
import { requireStudent } from "@/lib/session";
import { timeLeft } from "@/lib/time";

export default async function InvitesPage() {
  const { supabase, profile } = await requireStudent();
  const { data: rows } = await supabase.from("invites")
    .select("id, kind, team_id, status, expires_at, created_at, teams(name, track, needs)")
    .eq("student_id", profile.id).order("created_at", { ascending: false }).limit(50);
  const all = (rows ?? []).map((r) => ({ ...r, team: r.teams as unknown as { name: string; track: string | null; needs: string | null } }));
  const live = (r: (typeof all)[number]) => r.status === "pending" && new Date(r.expires_at) > new Date();
  const received = all.filter((r) => r.kind === "invite" && live(r));
  const myRequests = all.filter((r) => r.kind === "request" && live(r));
  const past = all.filter((r) => !live(r)).slice(0, 10);
  const label = (s: string, exp: string) => (s === "pending" && new Date(exp) <= new Date() ? "expired" : s);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-heading text-4xl font-bold">Invites</h1>
        <p className="mt-2 text-[16px] text-muted">Invites expire after 48 hours so nobody holds a spot forever.</p>
      </div>

      <section>
        <h2 className="font-heading text-2xl font-semibold">Invites to join a team</h2>
        {received.length === 0 ? (
          <p className="panel mt-3 text-[15px]">No invites right now. <Link href="/people" className="font-medium text-primary hover:underline">Find teammates</Link> or <Link href="/teams" className="font-medium text-primary hover:underline">ask to join a team</Link>.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {received.map((r) => (
              <li key={r.id} className="panel flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-heading text-lg font-semibold">{r.team?.name}</p>
                  <p className="text-[15px] text-muted">{r.team?.track ?? "Track not decided"}, {timeLeft(r.expires_at)}</p>
                </div>
                <span className="flex gap-2">
                  <ActionButton action={respondInvite.bind(null, r.id, true)}>Join team</ActionButton>
                  <ActionButton action={respondInvite.bind(null, r.id, false)} variant="secondary">Decline</ActionButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {myRequests.length > 0 && (
        <section>
          <h2 className="font-heading text-2xl font-semibold">Your requests to join</h2>
          <ul className="mt-3 space-y-3">
            {myRequests.map((r) => (
              <li key={r.id} className="panel flex flex-wrap items-center justify-between gap-4">
                <p><span className="font-semibold">{r.team?.name}</span> <span className="text-muted">hasn&apos;t answered yet, {timeLeft(r.expires_at)}</span></p>
                <ActionButton action={cancelInvite.bind(null, r.id)} variant="secondary">Withdraw</ActionButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="font-heading text-xl font-semibold">Earlier</h2>
          <ul className="mt-3 divide-y divide-line text-[15px]">
            {past.map((r) => (
              <li key={r.id} className="flex justify-between py-2">
                <span>{r.kind === "invite" ? "Invite from" : "Request to"} {r.team?.name ?? "a deleted team"}</span>
                <span className="text-muted">{label(r.status, r.expires_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
