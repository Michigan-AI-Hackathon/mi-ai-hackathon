import Link from "next/link";
import ActionButton from "@/components/ActionButton";
import CopyLink from "@/components/admin/CopyLink";
import { NewActivityForm, PrizeForm, RedeemForm } from "@/components/admin/PointsForms";
import PageHeader from "@/components/PageHeader";
import QrCode from "@/components/QrCode";
import { adminSetActivityActive } from "@/app/admin/points/actions";
import { requireAdmin } from "@/lib/admin";
import { siteUrl } from "@/lib/site";

export type Activity = { id: string; name: string; points: number; token: string; active: boolean; scans: number };
type Leader = { user_id: string; full_name: string | null; email: string; earned: number; spent: number; balance: number };

export default async function PointsAdminPage() {
  const { supabase } = await requireAdmin();
  const [{ data: acts }, { data: board }, { data: prizes }, { data: reds }] = await Promise.all([
    supabase.rpc("admin_points_activities"),
    supabase.rpc("admin_points_leaderboard", { p_limit: 200 }),
    supabase.from("prizes").select("id, name, cost, active").order("cost"),
    supabase.rpc("admin_recent_redemptions", { p_limit: 30 }),
  ]);
  const activities = (acts ?? []) as Activity[];
  const leaders = (board ?? []) as Leader[];
  const prizeList = (prizes ?? []) as { id: string; name: string; cost: number; active: boolean }[];
  const site = await siteUrl();

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Day of" title="Workshop points">Make a QR code for each workshop. Checked-in students scan it once to earn its points.</PageHeader>
      <NewActivityForm />

      {activities.length === 0 ? <p className="panel text-[15px] text-muted">No workshops yet.</p> : (
        <ul className="grid gap-5 lg:grid-cols-2">
          {activities.map((a) => {
            const url = `${site}/points?t=${a.token}`;
            return (
              <li key={a.id} className={`panel flex flex-col gap-4 ${a.active ? "" : "opacity-70"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="font-heading text-2xl font-semibold">{a.name}</h2><p className="text-sm text-muted">{a.points} points · {a.scans} scanned</p></div>
                  <span className={`chip ${a.active ? "border-ok text-ok" : "border-warn text-warn"}`}>{a.active ? "QR code on" : "Off"}</span>
                </div>
                <div className="w-fit rounded-xl border border-line bg-white p-3"><QrCode value={url} size={140} label={`QR code for ${a.name}`} /></div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/points/${a.id}`} className="btn-primary">Open poster</Link>
                  <CopyLink url={url} />
                  <ActionButton variant="secondary" action={adminSetActivityActive.bind(null, a.id, !a.active)}>{a.active ? "Turn off" : "Turn on"}</ActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="panel space-y-5">
        <h2 className="font-heading text-2xl font-semibold">Prizes</h2>
        <ul className="space-y-3">{prizeList.map((p) => <li key={p.id}><PrizeForm prize={p} /></li>)}</ul>
        <PrizeForm />
      </section>

      <section className="panel space-y-5">
        <h2 className="font-heading text-2xl font-semibold">Redeem a prize</h2>
        <p className="text-sm text-muted">Deducts the prize cost from their points. It fails if they do not have enough.</p>
        <RedeemForm people={leaders.filter((l) => l.balance > 0).map((l) => ({ id: l.user_id, name: l.full_name ?? l.email, balance: l.balance }))} prizes={prizeList.filter((p) => p.active)} />
        {(reds ?? []).length > 0 && (
          <ul className="divide-y divide-line text-[15px]">{(reds as { id: string; full_name: string | null; label: string; points: number; note: string | null; created_at: string }[]).map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{r.full_name ?? "Student"}: {r.label}{r.note ? ` (${r.note})` : ""}</span><span className="font-mono tabular-nums text-muted">-{r.points} · {new Date(r.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span></li>
          ))}</ul>
        )}
      </section>

      <section className="panel">
        <h2 className="font-heading text-2xl font-semibold">Leaderboard</h2>
        {leaders.length === 0 ? <p className="mt-3 text-[15px] text-muted">No points yet.</p> : (
          <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-[15px]">
            <thead className="text-sm text-muted"><tr><th className="py-2 pr-3">#</th><th className="pr-3">Name</th><th className="pr-3 text-right">Earned</th><th className="pr-3 text-right">Spent</th><th className="text-right">Balance</th></tr></thead>
            <tbody className="divide-y divide-line">{leaders.map((l, i) => (
              <tr key={l.user_id}><td className="py-2 pr-3 tabular-nums text-muted">{i + 1}</td><td className="pr-3"><span className="font-medium">{l.full_name ?? "No name"}</span> <span className="text-sm text-muted">{l.email}</span></td>
                <td className="pr-3 text-right tabular-nums">{l.earned}</td><td className="pr-3 text-right tabular-nums">{l.spent}</td><td className="text-right font-semibold tabular-nums">{l.balance}</td></tr>
            ))}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
