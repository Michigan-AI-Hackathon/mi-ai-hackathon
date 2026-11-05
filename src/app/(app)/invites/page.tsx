import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import { cancelInvite, respondInvite } from "@/app/actions";
import { requireStudent } from "@/lib/session";
import { timeLeft } from "@/lib/time";

export default async function InvitesPage() {
  const { supabase, profile } = await requireStudent();
  const { data: mine } = await supabase.from("team_members").select("team_id").eq("user_id", profile.id).maybeSingle();
  const { data: rows } = await supabase.from("invites")
    .select("id, kind, team_id, sent_by, status, expires_at, created_at, teams(name, track, needs)")
    .eq("student_id", profile.id).order("created_at", { ascending: false }).limit(50);
  const all = (rows ?? []).map((r) => ({ ...r, team: r.teams as unknown as { name: string; track: string | null; needs: string | null } }));
  const live = (r: (typeof all)[number]) => r.status === "pending" && new Date(r.expires_at) > new Date();
  const received = all.filter((r) => r.kind === "invite" && live(r));
  const myRequests = all.filter((r) => r.kind === "request" && live(r));
  const past = all.filter((r) => !live(r)).slice(0, 10);
  const senderIds = [...new Set(received.map((r) => r.sent_by).filter(Boolean))] as string[];
  const { data: senders } = senderIds.length ? await supabase.from("student_directory").select("id, full_name").in("id", senderIds) : { data: [] };
  const senderOf = (id: string | null) => senders?.find((x) => x.id === id);
  const label = (s: string, exp: string) => (s === "pending" && new Date(exp) <= new Date() ? "expired" : s);

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Invites" className="mb-0" />

      <section>
        <h2 className="sr-only">Received</h2>
        {received.length === 0 ? (
          <p className="panel mt-3 text-[15px]">No invites. <Link href="/people" className="font-medium text-primary hover:underline">Find teammates</Link> or {mine ? <Link href="/team" className="font-medium text-primary hover:underline">see your team</Link> : <Link href="/teams" className="font-medium text-primary hover:underline">browse teams</Link>}.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {received.map((r) => (
              <li key={r.id} className="panel panel-hover rise flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-heading text-lg font-semibold">{r.team?.name}</p>
                  <p className="text-[15px] text-muted">{r.team?.track ? `${r.team.track}, ` : ""}{timeLeft(r.expires_at)}</p>
                  {senderOf(r.sent_by) && <p className="text-[15px] text-muted">From <Link href={`/people/${r.sent_by}`} className="inline-flex min-h-11 items-center gap-1 font-medium text-primary hover:underline">{senderOf(r.sent_by)!.full_name} <span aria-hidden>›</span></Link></p>}
                </div>
                <span className="flex gap-2">
                  <ActionButton action={respondInvite.bind(null, r.id, true)}>Join</ActionButton>
                  <ActionButton action={respondInvite.bind(null, r.id, false)} variant="secondary">Decline</ActionButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {myRequests.length > 0 && (
        <section>
          <h2 className="font-heading text-2xl font-semibold">Sent requests</h2>
          <ul className="mt-3 space-y-3">
            {myRequests.map((r) => (
              <li key={r.id} className="panel flex flex-wrap items-center justify-between gap-4">
                <p><span className="font-semibold">{r.team?.name}</span> <span className="text-muted">{timeLeft(r.expires_at)}</span></p>
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
