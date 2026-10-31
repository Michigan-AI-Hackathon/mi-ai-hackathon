import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { requireAdmin } from "@/lib/admin";

type Stats = {
  signed_up: number; profiles_done: number; paid: number; revenue_cents: number; teams: number; locked_teams: number; on_team: number;
  solo_paid: number; checked_in: number; team_sizes: Record<string, number>;
  by_school: { name: string; n: number }[]; by_track: { name: string; n: number }[]; signups_by_day: { day: string; n: number }[];
};

function Tile({ label, value, sub, href }: { label: string; value: string | number; sub?: string; href?: string }) {
  const inner = (
    <div className="panel panel-hover h-full">
      <p className="eyebrow text-muted">{label}</p>
      <p className="mt-3 font-heading text-4xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Bars({ rows, max }: { rows: { name: string; n: number }[]; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.name} className="text-[14px]">
          <div className="flex justify-between gap-3"><span className="truncate">{r.name}</span><span className="tabular-nums text-muted">{r.n}</span></div>
          <div className="mt-1 h-2 rounded-full bg-line"><div className="h-2 rounded-full bg-accent" style={{ width: `${(r.n / m) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default async function Overview() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_stats");
  if (error || !data) return <p role="alert" className="text-danger">Couldn&apos;t load statistics: {error?.message}</p>;
  const s = data as Stats;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
  const days = s.signups_by_day;
  const maxDay = Math.max(1, ...days.map((d) => d.n));
  const funnel = [["Signed up", s.signed_up], ["Finished profile", s.profiles_done], ["Paid", s.paid], ["On a team", s.on_team]] as [string, number][];

  return (
    <div>
      <PageHeader eyebrow="Overview" title="How registration is going">Live numbers. They update every time you open this page.</PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Signed up" value={s.signed_up} sub={`${s.profiles_done} finished a profile`} href="/admin/students" />
        <Tile label="Paid" value={s.paid} sub={`${pct(s.paid, s.profiles_done)} of finished profiles`} href="/admin/students?f=paid" />
        <Tile label="Revenue" value={`$${(s.revenue_cents / 100).toLocaleString()}`} sub="Stripe payments, not refunded" />
        <Tile label="Need a team" value={s.solo_paid} sub="Paid, no team yet" href="/admin/day-of" />
        <Tile label="Teams" value={s.teams} sub={`${s.locked_teams} locked in`} href="/admin/teams" />
        <Tile label="On a team" value={s.on_team} sub={`${pct(s.on_team, s.paid)} of paid students`} />
        <Tile label="Checked in" value={s.checked_in} sub={`of ${s.paid} paid`} href="/admin/day-of" />
        <Tile label="Full teams" value={s.team_sizes["4"] ?? 0} sub={`${s.team_sizes["3"] ?? 0} have 3, ${s.team_sizes["2"] ?? 0} have 2, ${s.team_sizes["1"] ?? 0} have 1`} href="/admin/teams?f=incomplete" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel">
          <h2 className="font-heading text-xl font-semibold">Sign-ups, last 30 days</h2>
          {days.length === 0 ? <p className="mt-4 text-[15px] text-muted">No sign-ups yet.</p> : (
            <div className="mt-6 flex h-40 items-end gap-1" role="img" aria-label="Sign-ups per day">
              {days.map((d) => (
                <div key={d.day} className="group relative flex-1" title={`${d.day}: ${d.n}`}>
                  <div className="w-full rounded-t bg-accent transition-all group-hover:bg-ink" style={{ height: `${Math.max(4, (d.n / maxDay) * 100)}%` }} />
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm text-muted">Peak day: {maxDay} sign-ups</p>
        </section>
        <section className="panel">
          <h2 className="font-heading text-xl font-semibold">From sign-up to team</h2>
          <ul className="mt-5 space-y-3 text-[15px]">
            {funnel.map(([l, n]) => (
              <li key={l}><div className="flex justify-between"><span>{l}</span><span className="tabular-nums text-muted">{n} · {pct(n, s.signed_up)}</span></div>
                <div className="mt-1 h-2 rounded-full bg-line"><div className="h-2 rounded-full bg-ink" style={{ width: `${s.signed_up ? (n / s.signed_up) * 100 : 0}%` }} /></div></li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel"><h2 className="mb-5 font-heading text-xl font-semibold">Students by school</h2><Bars rows={s.by_school} /></section>
        <section className="panel"><h2 className="mb-5 font-heading text-xl font-semibold">Interest by track</h2><Bars rows={s.by_track} /></section>
      </div>
    </div>
  );
}
