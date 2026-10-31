import Link from "next/link";
import Avatar from "@/components/Avatar";
import Countdown from "@/components/Countdown";
import PayButton from "@/components/PayButton";
import QrCode from "@/components/QrCode";
import { siteUrl } from "@/lib/site";
import { AvatarStack, SeatPips } from "@/components/Seats";
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
  const passUrl = paid ? `${await siteUrl()}/admin/pass/${profile.id}` : null;
  const first = profile.full_name?.split(" ")[0] ?? "there";
  const flags = [true, true, paid, !!team, !!team?.locked_at];
  const doneCount = flags.filter(Boolean).length;
  const current = flags.findIndex((f) => !f);

  return (
    <div>
      <div className="rise mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-5">
          <Avatar url={profile.avatar_url} name={profile.full_name} size={64} />
          <div>
            <p className="eyebrow text-primary">{sp.welcome ? "Welcome" : "Your dashboard"}</p>
            <h1 className="mt-1 font-heading text-4xl font-bold sm:text-5xl">{sp.welcome ? `Welcome, ${first}.` : `Hi, ${first}.`}</h1>
          </div>
        </div>
        <div className="min-w-56">
          <p className="text-sm text-muted"><span className="font-semibold text-ink">{doneCount} of 5</span> steps done</p>
          <div className="mt-2 flex gap-1.5" aria-hidden>
            {flags.map((f, i) => <span key={i} className={`h-2 flex-1 rounded-full transition-colors duration-700 ${f ? "bg-accent" : "bg-line"}`} />)}
          </div>
        </div>
      </div>

      {sp.paid && !paid && (
        <p role="status" className="mb-6 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-[15px]">
          Payment received. It can take a few seconds to show up here, so refresh in a moment.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="panel rise p-6 sm:p-8" style={{ "--i": 2 } as React.CSSProperties}>
          <h2 className="mb-7 font-heading text-xl font-semibold">Before the hackathon</h2>
          <ol>
            <Step n={1} done current={false} title="Create your account" />
            <Step n={2} done current={false} title="Set up your profile">
              <Link href="/onboarding" className="link-draw font-medium text-ink">Edit your profile</Link>
            </Step>
            <Step n={3} done={paid} current={current === 2} title={paid ? "Registration paid" : `Pay the ${fee.label} registration fee`}>
              {paid ? (
                <>Paid {new Date(profile.paid_at!).toLocaleDateString()}. Thank you.</>
              ) : (
                <>
                  <p>{fee.earlyBird ? "Early-bird price. " : ""}Have a coupon code? Enter it at checkout. The fee is non-refundable, and you need to pay before you can join a team or appear in search.</p>
                  <form action={startCheckout} className="mt-4"><PayButton label={`Pay ${fee.label}`} /></form>
                </>
              )}
            </Step>
            <Step n={4} done={!!team} current={current === 3} title={team ? `On team ${team.name}` : "Join or create a team"}>
              {team ? (
                <div className="mt-1 flex flex-wrap items-center gap-4">
                  <AvatarStack people={members} />
                  <SeatPips filled={teamSize} />
                  <Link href="/team" className="link-draw font-medium text-ink">Go to your team</Link>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/people" className="btn-primary">Find teammates</Link>
                  <Link href="/teams" className="btn-secondary">Browse open teams</Link>
                </div>
              )}
            </Step>
            <Step n={5} done={!!team?.locked_at} current={current === 4} last title={team?.locked_at ? "Team locked in" : "Lock in your team"}>
              {team?.locked_at ? "Your spot is guaranteed." : (
                <>Locked teams are guaranteed a spot. Deadline: {settings?.lock_deadline ? new Date(settings.lock_deadline).toLocaleDateString(undefined, { month: "long", day: "numeric" }) : LOCK_DEADLINE_LABEL.toLowerCase()}.</>
              )}
            </Step>
          </ol>
        </section>

        <aside className="space-y-6">
          <div className="hero-panel rise p-6 sm:p-7" style={{ "--i": 3 } as React.CSSProperties}>
            <p className="font-heading text-lg font-semibold">The hackathon starts in</p>
            <div className="mt-5"><Countdown to={EVENT.startsAt} size="md" /></div>
            <p className="mt-6 border-t border-on-hero/15 pt-4 text-sm text-on-hero/65">{EVENT.dateLabel} · {EVENT.place}</p>
          </div>
          {passUrl && (
            <div className="panel rise text-center" style={{ "--i": 4 } as React.CSSProperties}>
              <p className="eyebrow text-muted">Your event pass</p>
              <div className="mx-auto mt-4 w-fit rounded-xl border border-line bg-white p-3"><QrCode value={passUrl} size={150} label="Your personal check-in QR code" /></div>
              <p className="mt-3 text-sm text-muted">{profile.checked_in_at ? "You're checked in." : "At the event, scan the venue QR code, or show this pass at the desk."}</p>
            </div>
          )}
          <div className="panel rise" style={{ "--i": 5 } as React.CSSProperties}>
            <p className="eyebrow text-muted">Jump to</p>
            <ul className="mt-3 divide-y divide-line text-[15px]">
              {[["/people", "Find teammates", "Search every school"], ["/teams", "Open teams", "Ask to join one"], ["/invites", "Invites", "Answer your invites"], ["/messages", "Messages", "Team chat and direct"]].map(([h, t, d]) => (
                <li key={h}>
                  <Link href={h} className="group flex items-center justify-between py-3 transition-[padding] duration-300 hover:pl-1.5">
                    <span><span className="block font-semibold">{t}</span><span className="text-muted">{d}</span></span>
                    <span aria-hidden className="text-lg transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
