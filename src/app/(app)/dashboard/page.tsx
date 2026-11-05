import Link from "next/link";
import Avatar from "@/components/Avatar";
import Countdown from "@/components/Countdown";
import PayButton from "@/components/PayButton";
import { SeatPips } from "@/components/Seats";
import { startCheckout } from "@/app/actions";
import { EVENT, LOCK_DEADLINE_LABEL, currentFee } from "@/lib/config";
import { requireStudent } from "@/lib/session";
import type { Student } from "@/lib/types";

function Step({ n, done, current, title, last, children }: { n: number; done: boolean; current: boolean; title: string; last?: boolean; children?: React.ReactNode }) {
  return (
    <li className="relative flex gap-5 pb-8 last:pb-0">
      {!last && <span aria-hidden className={`absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-px ${done ? "bg-accent" : "bg-line"}`} />}
      <span aria-hidden className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-all ${done ? "bg-ink text-card" : current ? "bg-accent text-hero ring-4 ring-accent/25" : "border border-line bg-card text-muted"}`}>
        {done ? <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg> : n}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className={`font-heading text-lg font-semibold ${!done && !current ? "text-muted" : ""}`}>{title}<span className="sr-only">{done ? " (done)" : current ? " (next)" : " (later)"}</span></p>
        {children && <div className="mt-1.5 text-[15px] leading-relaxed text-muted">{children}</div>}
      </div>
    </li>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ paid?: string; welcome?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireStudent();
  const [{ data: membership }, { data: settings }] = await Promise.all([
    supabase.from("team_members").select("team_id, teams(name, locked_at)").eq("user_id", profile.id).maybeSingle(),
    supabase.from("app_settings").select("lock_deadline, require_payment").single(),
  ]);
  const team = membership?.teams as unknown as { name: string; locked_at: string | null } | null;
  let members: Student[] = [];
  if (membership) {
    const { data } = await supabase.from("student_directory").select("*").eq("team_id", membership.team_id);
    members = (data ?? []) as Student[];
  }
  const teamSize = members.length;
  const paid = !!profile.paid_at;
  const fee = currentFee();
  const pass = paid ? (
    <div className="panel rise" style={{ "--i": 1 } as React.CSSProperties}>
      <p className="eyebrow text-muted">Event check-in</p>
      {profile.checked_in_at
        ? <p className="mt-2 font-heading text-lg font-semibold">Checked in</p>
        : <>
            <p className="mt-2 text-[15px]">Scan the QR code at the venue to check in.</p>
            <Link href="/checkin" className="link-draw mt-2 inline-block text-sm font-medium text-ink">How check-in works</Link>
          </>}
    </div>
  ) : null;
  const first = profile.full_name?.split(" ")[0] ?? "there";
  const flags = [paid, !!team, !!team?.locked_at];
  const current = flags.findIndex((f) => !f);

  return (
    <div>
      <div className="rise mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-5">
          <div>
            <h1 className="mt-1 font-heading text-4xl font-bold sm:text-5xl">{sp.welcome ? `Welcome, ${first}.` : `Hi, ${first}.`}</h1>
          </div>
        </div>
        <Link href="/onboarding" aria-label="Edit your profile" className="rounded-full transition-transform hover:scale-105">
          <Avatar url={profile.avatar_url} name={profile.full_name} size={88} />
        </Link>
      </div>

      {sp.paid && !paid && (
        <p role="status" className="mb-6 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-[15px]">
          Payment received. It can take a few seconds to show up here, so refresh in a moment.
        </p>
      )}

      {pass && <div className="mb-6 lg:hidden">{pass}</div>}

      <section className="rise mb-6 rounded-2xl border-2 border-ink bg-card p-6 sm:p-8" aria-labelledby="next-h">
        {current === 0 && (<>
          <h2 id="next-h" className="mt-1 font-heading text-2xl font-bold">Pay the {fee.label} registration fee</h2>
          <form action={startCheckout} className="mt-4"><PayButton label={`Pay ${fee.label}`} /></form>
        </>)}
        {current === 1 && (<>
          <h2 id="next-h" className="mt-1 font-heading text-2xl font-bold">Get on a team of 4</h2>
          <div className="mt-4 flex flex-wrap gap-2"><Link href="/teams" className="btn-primary">Teams</Link><Link href="/people" className="btn-secondary">Find teammates</Link></div>
        </>)}
        {current === 2 && (<>
          <h2 id="next-h" className="mt-1 font-heading text-2xl font-bold">Lock in your team</h2>
          <p className="mt-1 text-[15px] text-muted">Deadline: {settings?.lock_deadline ? new Date(settings.lock_deadline).toLocaleDateString(undefined, { month: "long", day: "numeric" }) : LOCK_DEADLINE_LABEL.toLowerCase()}.</p>
          <div className="mt-4"><Link href="/team" className="btn-primary">My team</Link></div>
        </>)}
        {current === -1 && (<>
          <h2 id="next-h" className="mt-1 font-heading text-2xl font-bold">You&apos;re all set</h2>
          <div className="mt-4"><Link href="/messages" className="btn-primary">Team chat</Link></div>
        </>)}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="panel rise p-6 sm:p-8" style={{ "--i": 2 } as React.CSSProperties}>
          <h2 className="mb-7 font-heading text-xl font-semibold">Checklist</h2>
          <ol>
            <Step n={1} done={paid} current={current === 0} title={paid ? "Registration paid" : `Pay the ${fee.label} registration fee`}>
              {paid ? <>Paid {new Date(profile.paid_at!).toLocaleDateString()}.</> : <>Non-refundable.</>}
            </Step>
            <Step n={2} done={!!team} current={current === 1} title={team ? `On team ${team.name}` : "Join or create a team"}>
              {team && (
                <div className="mt-1 space-y-3">
                  <ul className="flex flex-wrap gap-2">
                    {members.map((m) => (
                      <li key={m.id}><Link href={`/people/${m.id}`} className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3 text-ink transition-all hover:-translate-y-0.5 hover:border-ink hover:text-primary active:scale-95">
                        <Avatar url={m.avatar_url} name={m.full_name} size={32} /><span className="text-sm font-medium">{m.full_name}</span><span aria-hidden className="text-primary">›</span></Link></li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-4"><SeatPips filled={teamSize} /><Link href="/team" className="link-draw font-medium text-ink">My team</Link></div>
                </div>
              )}
            </Step>
            <Step n={3} done={!!team?.locked_at} current={current === 2} last title={team?.locked_at ? "Team locked in" : "Lock in your team"}>
              {team?.locked_at ? null : "Needs all 4 people."}
            </Step>
          </ol>
        </section>

        <aside className="space-y-6">
          <div className="hero-panel rise p-6 sm:p-7" style={{ "--i": 3 } as React.CSSProperties}>
            <p className="font-heading text-lg font-semibold">The hackathon starts in</p>
            <div className="mt-5"><Countdown to={EVENT.startsAt} size="md" /></div>
            <p className="mt-6 border-t border-on-hero/15 pt-4 text-sm text-on-hero/65">{EVENT.dateLabel} · {EVENT.place}</p>
          </div>
          {pass && <div className="hidden lg:block">{pass}</div>}
        </aside>
      </div>
    </div>
  );
}
