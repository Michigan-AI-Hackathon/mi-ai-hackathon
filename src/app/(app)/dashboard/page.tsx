import Link from "next/link";
import Countdown from "@/components/Countdown";
import PayButton from "@/components/PayButton";
import { startCheckout } from "@/app/actions";
import { EVENT } from "@/lib/config";
import { requireStudent } from "@/lib/session";

function Step({ done, title, children }: { done: boolean; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-4 border-t border-line py-5 first:border-t-0">
      <span aria-hidden className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-ok text-on-primary" : "border-2 border-line text-muted"}`}>
        {done ? "✓" : ""}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-lg font-semibold">{title}<span className="sr-only">{done ? " (done)" : " (to do)"}</span></p>
        {children && <div className="mt-1 text-[15px] text-muted">{children}</div>}
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
  let teamSize = 0;
  if (membership) {
    const { count } = await supabase.from("team_members").select("*", { count: "exact", head: true }).eq("team_id", membership.team_id);
    teamSize = count ?? 0;
  }
  const paid = !!profile.paid_at;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div>
        <h1 className="font-heading text-4xl font-bold">
          {sp.welcome ? `Welcome, ${profile.full_name?.split(" ")[0]}.` : `Hi, ${profile.full_name?.split(" ")[0]}.`}
        </h1>
        <p className="mt-2 text-[16px] text-muted">Here&apos;s what&apos;s left before the hackathon.</p>
        {sp.paid && !paid && (
          <p role="status" className="mt-4 rounded-lg bg-primary/10 px-4 py-3 text-[15px]">
            Payment received. It can take a few seconds to show up here, so refresh in a moment.
          </p>
        )}

        <ol className="panel mt-6 py-1">
          <Step done title="Create your account" />
          <Step done title="Set up your profile">
            <Link href="/onboarding" className="font-medium text-primary hover:underline">Edit your profile</Link>
          </Step>
          <Step done={paid} title={paid ? "Registration paid" : `Pay the ${EVENT.feeLabel} registration fee`}>
            {paid ? (
              <>Paid {new Date(profile.paid_at!).toLocaleDateString()}.</>
            ) : (
              <>
                <p>The fee is non-refundable. You need to pay before you can join a team or appear in search.</p>
                <form action={startCheckout} className="mt-3"><PayButton label={`Pay ${EVENT.feeLabel}`} /></form>
              </>
            )}
          </Step>
          <Step done={!!team} title={team ? `On team ${team.name}` : "Join or create a team"}>
            {team ? (
              <>{teamSize} of 4 spots filled. <Link href="/team" className="font-medium text-primary hover:underline">Go to your team</Link></>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href="/people" className="btn-secondary">Find teammates</Link>
                <Link href="/teams" className="btn-secondary">Browse open teams</Link>
              </div>
            )}
          </Step>
          <Step done={!!team?.locked_at} title={team?.locked_at ? "Team locked in" : "Lock in your team"}>
            {team?.locked_at ? "Your spot is guaranteed." : (
              <>
                Locked teams are guaranteed a spot.
                {settings?.lock_deadline && <> Deadline: {new Date(settings.lock_deadline).toLocaleDateString(undefined, { month: "long", day: "numeric" })}.</>}
              </>
            )}
          </Step>
        </ol>
      </div>

      <aside className="space-y-4">
        <div className="hero-panel p-6 text-on-hero">
          <p className="text-sm font-semibold text-on-hero/85">Hackathon starts in</p>
          <p className="mt-2 font-heading text-3xl font-bold"><Countdown to={EVENT.startsAt} size="sm" /></p>
          <p className="mt-3 text-sm text-on-hero/85">{EVENT.dateLabel}, {EVENT.place}</p>
        </div>
        {settings?.lock_deadline && !team?.locked_at && (
          <div className="panel">
            <p className="text-sm font-semibold">Lock-in deadline</p>
            <p className="mt-1 font-heading text-2xl font-bold"><Countdown to={settings.lock_deadline} size="sm" /></p>
          </div>
        )}
      </aside>
    </div>
  );
}
