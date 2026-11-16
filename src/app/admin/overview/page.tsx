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
  // One bar for every one of the last 30 days, so quiet days show as gaps instead of being left out.
  const counts = new Map(s.signups_by_day.map((d) => [String(d.day).slice(0, 10), d.n]));
  const series = Array.from({ length: 30 }, (_, i) => {
    const dt = new Date(Date.now() - (29 - i) * 86_400_000);
    const day = dt.toISOString().slice(0, 10);
    return { day, n: counts.get(day) ?? 0, label: dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) };
  });
  const total = series.reduce((n, d) => n + d.n, 0);
  const maxDay = Math.max(1, ...series.map((d) => d.n));
  const funnel = [["Signed up", s.signed_up], ["Finished profile", s.profiles_done], ["Paid", s.paid], ["On a team", s.on_team]] as [string, number][];

  return (
    <div>
      <PageHeader eyebrow="Overview" title="How registration is going">Live numbers. They update every time you open this page.</PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile label="Signed up" value={s.signed_up} sub={`${s.profiles_done} finished a profile`} href="/admin/students" />
        <Tile label="Paid" value={s.paid} sub={`${pct(s.paid, s.profiles_done)} of finished profiles`} href="/admin/students?f=paid" />
        <Tile label="Revenue" value={`$${(s.revenue_cents / 100).toLocaleString()}`} sub="Stripe payments, not refunded" />
        <Tile label="Need a team" value={s.solo_paid} sub="Paid, no team yet" href="/admin/day-of" />
        <Tile label="Teams" value={s.teams} sub={`${s.team_sizes["4"] ?? 0} full, ${s.locked_teams} locked in`} href="/admin/teams" />
        <Tile label="Checked in" value={s.checked_in} sub={`of ${s.paid} paid`} href="/admin/day-of" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-xl font-semibold">Sign-ups, last 30 days</h2>
            <p className="text-sm text-muted">{total} total</p>
          </div>
          <div className="mt-6 flex h-40 items-end gap-[3px] border-b border-line" role="img" aria-label={`Sign-ups per day for the last 30 days. ${total} in total, most in one day: ${maxDay}.`}>
            {series.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 items-end" title={`${d.label}: ${d.n} sign-up${d.n === 1 ? "" : "s"}`}>
                <div className={`w-full rounded-t-sm transition-colors ${d.n ? "bg-accent group-hover:bg-ink" : "bg-line"}`} style={{ height: d.n ? `${Math.max(8, (d.n / maxDay) * 100)}%` : "3px" }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted"><span>{series[0].label}</span><span>Most in a day: {maxDay}</span><span>Today</span></div>
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

      <details className="panel mt-6 group">
        <summary className="cursor-pointer font-heading text-xl font-semibold">Breakdowns by school and track</summary>
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <section><h2 className="mb-4 text-sm font-semibold text-muted">Students by school</h2><Bars rows={s.by_school} /></section>
          <section><h2 className="mb-4 text-sm font-semibold text-muted">Interest by track</h2><Bars rows={s.by_track} /></section>
        </div>
      </details>
    </div>
  );
}
