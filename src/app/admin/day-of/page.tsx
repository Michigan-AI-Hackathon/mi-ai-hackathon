import AutoFill from "@/components/admin/AutoFill";
import CheckInPanel from "@/components/admin/CheckInPanel";
import QrCode from "@/components/QrCode";
import { siteUrl } from "@/lib/site";
import Avatar from "@/components/Avatar";
import ActionButton from "@/components/ActionButton";
import PageHeader from "@/components/PageHeader";
import { adminCheckIn } from "@/app/admin/actions";
import Link from "next/link";
import { EVENT } from "@/lib/config";
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

  type Row = { id: string; full_name: string | null; email: string; avatar_url: string | null; checked_in_at: string | null; paid_at: string | null; onboarded_at: string | null };
  const cols = "id, full_name, email, avatar_url, checked_in_at, paid_at, onboarded_at";
  // With a search: anyone matching (so a check-in can be undone or a phone failure fixed). Without: paid people not yet in.
  let query = supabase.from("profiles").select(cols);
  query = q ? query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`) : query.not("paid_at", "is", null).is("checked_in_at", null);
  const { data: rows } = await query.order("full_name").limit(q ? 15 : 100);
  const list = (rows ?? []) as Row[];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="print:hidden"><PageHeader eyebrow="Day of" title="Check-in">Students scan the venue code with their phone.</PageHeader></div>

      {cfg && <CheckInPanel open={cfg.open} url={checkinUrl} eventName={EVENT.name}><QrCode value={checkinUrl} size={352} label="Check-in QR code" /></CheckInPanel>}

      <div className="grid grid-cols-3 gap-2 sm:gap-4 print:hidden">
        <div className="panel !p-4"><p className="eyebrow text-muted">Checked in</p><p className="mt-2 font-heading text-3xl font-bold tabular-nums sm:text-4xl">{s?.checked_in ?? 0}<span className="text-base text-muted sm:text-xl"> of {s?.paid ?? 0}</span></p></div>
        <div className="panel !p-4"><p className="eyebrow text-muted">Paid, no team</p><p className="mt-2 font-heading text-3xl font-bold tabular-nums sm:text-4xl">{s?.solo_paid ?? 0}</p></div>
        <div className="panel !p-4"><p className="eyebrow text-muted">Open seats</p><p className="mt-2 font-heading text-3xl font-bold tabular-nums sm:text-4xl">{openSeats}</p></div>
      </div>

      <section className="panel print:hidden">
        <h2 className="font-heading text-2xl font-semibold">{q ? "Search" : "Not checked in yet"}</h2>
        <form className="mt-4 flex gap-2 sm:gap-3" role="search">
          <label htmlFor="q" className="sr-only">Name or email</label>
          <input id="q" name="q" defaultValue={raw} className="input min-h-11 min-w-0 max-w-md flex-1" placeholder="Name or email" type="search" enterKeyHint="search" autoComplete="off" autoCapitalize="none" spellCheck={false} />
          <button className="btn-primary min-h-11">Find</button>
          {q && <Link href="/admin/day-of" className="btn-secondary min-h-11">Clear</Link>}
        </form>
        <ul className="mt-4 divide-y divide-line">
          {list.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar url={p.avatar_url} name={p.full_name} size={40} />
              <div className="min-w-0 flex-1 basis-40"><p className="truncate font-semibold">{p.full_name ?? "No name"}</p><p className="truncate text-sm text-muted">{p.email}{!p.paid_at && " · not paid"}{p.paid_at && !p.onboarded_at && " · profile unfinished"}</p></div>
              <ActionButton className="min-h-11" action={adminCheckIn.bind(null, p.id, !p.checked_in_at)} variant={p.checked_in_at ? "secondary" : "primary"}>{p.checked_in_at ? "Undo check-in" : "Check in"}</ActionButton>
            </li>
          ))}
          {list.length === 0 && <li className="py-3 text-[15px] text-muted">{q ? "No one matches." : "Everyone paid is checked in."}</li>}
        </ul>
      </section>

      <div className="print:hidden"><AutoFill solos={s?.solo_paid ?? 0} openSeats={openSeats} /></div>
    </div>
  );
}
