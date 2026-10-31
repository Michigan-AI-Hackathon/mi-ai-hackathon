import AutoFill from "@/components/admin/AutoFill";
import CheckInPanel from "@/components/admin/CheckInPanel";
import QrCode from "@/components/QrCode";
import { siteUrl } from "@/lib/site";
import Avatar from "@/components/Avatar";
import ActionButton from "@/components/ActionButton";
import PageHeader from "@/components/PageHeader";
import { adminCheckIn } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin";

export default async function DayOfPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw } = await searchParams;
  const q = (raw ?? "").replace(/[,()%*\\.]/g, " ").trim().slice(0, 60);
  const { supabase } = await requireAdmin();
  const { data: cfgRaw } = await supabase.rpc("admin_checkin_config");
  const cfg = cfgRaw as { open: boolean; token: string } | null;
  const checkinUrl = cfg ? `${await siteUrl()}/checkin?t=${cfg.token}` : "";
  const [{ data: stats }, { data: teams }, { data: members }] = await Promise.all([
    supabase.rpc("admin_stats"),
    supabase.from("teams").select("id, locked_at"),
    supabase.from("team_members").select("team_id, user_id"),
  ]);
  const s = stats as { solo_paid: number; checked_in: number; paid: number } | null;
  const size = new Map<string, number>(); (members ?? []).forEach((m) => size.set(m.team_id, (size.get(m.team_id) ?? 0) + 1));
  const openSeats = (teams ?? []).filter((t) => !t.locked_at).reduce((n, t) => n + Math.max(0, 4 - (size.get(t.id) ?? 0)), 0);

  let found: { id: string; full_name: string | null; email: string; avatar_url: string | null; checked_in_at: string | null; paid_at: string | null }[] = [];
  if (q) {
    const { data } = await supabase.from("profiles").select("id, full_name, email, avatar_url, checked_in_at, paid_at").or(`full_name.ilike.%${q}%,email.ilike.%${q}%`).limit(15);
    found = (data ?? []) as typeof found;
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Day of" title="Check-in and last-minute fixes">Check people in, fill teams for students without one, and handle emergencies.</PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel"><p className="eyebrow text-muted">Checked in</p><p className="mt-3 font-heading text-4xl font-bold tabular-nums">{s?.checked_in ?? 0}<span className="text-xl text-muted"> / {s?.paid ?? 0}</span></p></div>
        <div className="panel"><p className="eyebrow text-muted">Paid, no team</p><p className="mt-3 font-heading text-4xl font-bold tabular-nums">{s?.solo_paid ?? 0}</p></div>
        <div className="panel"><p className="eyebrow text-muted">Open seats</p><p className="mt-3 font-heading text-4xl font-bold tabular-nums">{openSeats}</p></div>
      </div>

      {cfg && <CheckInPanel open={cfg.open} url={checkinUrl}><QrCode value={checkinUrl} size={220} label="Check-in QR code" /></CheckInPanel>}

      <section className="panel">
        <h2 className="font-heading text-2xl font-semibold">Check someone in</h2>
        <form className="mt-4 flex gap-3" role="search">
          <label htmlFor="q" className="sr-only">Name or email</label>
          <input id="q" name="q" defaultValue={raw} className="input max-w-md" placeholder="Name or email" />
          <button className="btn-primary">Find</button>
        </form>
        {q && (
          <ul className="mt-4 divide-y divide-line">
            {found.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar url={p.avatar_url} name={p.full_name} size={40} />
                <div className="min-w-0 flex-1"><p className="font-semibold">{p.full_name ?? "No name"}</p><p className="truncate text-sm text-muted">{p.email}{!p.paid_at && " · not paid"}</p></div>
                <ActionButton action={adminCheckIn.bind(null, p.id, !p.checked_in_at)} variant={p.checked_in_at ? "secondary" : "primary"}>{p.checked_in_at ? "Undo check-in" : "Check in"}</ActionButton>
              </li>
            ))}
            {found.length === 0 && <li className="py-3 text-[15px] text-muted">No one matches.</li>}
          </ul>
        )}
      </section>

      <AutoFill solos={s?.solo_paid ?? 0} openSeats={openSeats} />
    </div>
  );
}
