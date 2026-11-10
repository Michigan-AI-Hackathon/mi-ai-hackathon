import Link from "next/link";
import AutoScan from "@/components/AutoScan";
import PageHeader from "@/components/PageHeader";
import { requireStudent } from "@/lib/session";

export const metadata = { title: "Points" };
type Row = { id: string; label: string; points: number; created_at: string };

// Student's points balance and history. Opened with ?t=<workshop code> when they scan a workshop QR code.
export default async function PointsPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const { supabase, profile } = await requireStudent();
  const scanning = !!t && /^[a-f0-9]{16,64}$/i.test(t);
  if (scanning && !profile.checked_in_at) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <h1 className="font-heading text-3xl font-bold">Check in first</h1>
        <p className="mt-3 text-muted">Scan the check-in QR code at the venue, then scan this workshop code again.</p>
        <Link href="/checkin" className="btn-primary mt-6">Check in</Link>
      </div>
    );
  }
  if (scanning) return <div className="mx-auto max-w-md py-10"><AutoScan token={t!} /></div>;

  const [{ data: earned }, { data: spent }, { data: bal }, { data: prizes }] = await Promise.all([
    supabase.from("point_ledger").select("id, label, points, created_at").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("prize_redemptions").select("id, label, points, created_at").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(100),
    supabase.rpc("my_points"),
    supabase.from("prizes").select("id, name, cost").eq("active", true).order("cost"),
  ]);
  const history = [
    ...((earned ?? []) as Row[]).map((r) => ({ ...r, points: r.points })),
    ...((spent ?? []) as Row[]).map((r) => ({ ...r, points: -r.points })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-6">
      <PageHeader title="Points">Scan the QR codes at workshops to earn points, then trade them for prizes at the desk.</PageHeader>
      <div className="panel"><p className="eyebrow text-muted">Your balance</p><p className="mt-2 font-heading text-5xl font-bold tabular-nums">{(bal as number | null) ?? 0}</p></div>
      {(prizes ?? []).length > 0 && (
        <section className="panel"><h2 className="font-heading text-xl font-semibold">Prizes</h2>
          <ul className="mt-3 divide-y divide-line">{(prizes ?? []).map((p) => <li key={p.id} className="flex justify-between gap-3 py-2"><span>{p.name}</span><span className="font-mono tabular-nums text-muted">{p.cost} pts</span></li>)}</ul>
        </section>
      )}
      <section className="panel"><h2 className="font-heading text-xl font-semibold">History</h2>
        {history.length === 0 ? <p className="mt-3 text-[15px] text-muted">Nothing yet. Scan a workshop QR code to get started.</p> : (
          <ul className="mt-3 divide-y divide-line">{history.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0"><p className="truncate font-medium">{h.points < 0 ? `Redeemed: ${h.label}` : h.label}</p><p className="text-sm text-muted">{new Date(h.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p></div>
              <span className={`font-mono font-semibold tabular-nums ${h.points < 0 ? "text-muted" : "text-ok"}`}>{h.points > 0 ? "+" : ""}{h.points}</span>
            </li>))}</ul>
        )}
      </section>
    </div>
  );
}
