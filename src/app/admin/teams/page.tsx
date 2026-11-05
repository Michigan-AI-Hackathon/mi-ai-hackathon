import Link from "next/link";
import ActionButton from "@/components/ActionButton";
import Avatar from "@/components/Avatar";
import { AdminAssign, Drag, DragArea, Drop } from "@/components/DragDrop";
import PageHeader from "@/components/PageHeader";
import { SeatPips } from "@/components/Seats";
import { adminDissolveTeam, adminRemoveFromTeam, adminSetTeamLock } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin";

type Member = { id: string; full_name: string | null; school_id: number; paid_at: string | null; onboarded_at?: string | null; checked_in_at: string | null; avatar_url: string | null };

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: teams }, { data: tm }, { data: people }, { data: schools }] = await Promise.all([
    supabase.from("teams").select("id, name, track, locked_at, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("team_members").select("team_id, user_id"),
    supabase.from("profiles").select("id, full_name, school_id, paid_at, onboarded_at, checked_in_at, avatar_url").limit(5000),
    supabase.from("schools").select("id, name, rule_group"),
  ]);
  const person = new Map((people ?? []).map((p) => [p.id as string, p as Member]));
  const school = new Map((schools ?? []).map((s) => [s.id as number, s as { id: number; name: string; rule_group: string | null }]));
  const groupOf = (m: Member) => school.get(m.school_id)?.rule_group ?? `school-${m.school_id}`;

  const rows = (teams ?? []).map((t) => {
    const members = (tm ?? []).filter((x) => x.team_id === t.id).map((x) => person.get(x.user_id)).filter(Boolean) as Member[];
    const groups = new Set(members.map(groupOf)).size;
    const flags: string[] = [];
    if (members.length < 4) flags.push(`Needs ${4 - members.length} more`);
    if (members.length === 4 && groups < 3) flags.push("Fewer than 3 schools");
    const unpaid = members.filter((m) => !m.paid_at).length;
    if (unpaid) flags.push(`${unpaid} unpaid`);
    if (t.locked_at && members.length < 4) flags.push("Locked but incomplete");
    return { ...t, members, groups, flags };
  }).filter((t) => f === "incomplete" ? t.flags.length > 0 : f === "locked" ? !!t.locked_at : f === "open" ? !t.locked_at : true);

  const placed = new Set((tm ?? []).map((x) => x.user_id as string));
  const unassigned = (people ?? []).filter((p) => p.onboarded_at && !placed.has(p.id)).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "")).slice(0, 80) as Member[];
  const openTeams = rows.filter((t) => !t.locked_at && t.members.length < 4).map((t) => ({ id: t.id as string, name: t.name as string, open: 4 - t.members.length }));

  return (
    <DragArea>
      <PageHeader eyebrow="Teams" title="Every team">Drag a student onto a team to place them. Teams that need attention are flagged.</PageHeader>
      {unassigned.length > 0 && (
        <section className="panel mb-6">
          <h2 className="font-heading text-lg font-semibold">No team yet <span className="text-muted">({unassigned.length})</span></h2>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {unassigned.map((m) => (
              <Drag as="li" key={m.id} kind="person" id={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-card px-3 py-2 text-[15px]">
                <Avatar url={m.avatar_url} name={m.full_name} size={28} />
                <span className="min-w-0 flex-1 truncate">{m.full_name}<span className="text-muted"> · {school.get(m.school_id)?.name}</span></span>
                {!m.paid_at && <span className="chip border-warn text-warn">Unpaid</span>}
                <AdminAssign studentId={m.id} teams={openTeams} />
              </Drag>
            ))}
          </ul>
        </section>
      )}
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        {[["", "All"], ["incomplete", "Needs attention"], ["open", "Not locked"], ["locked", "Locked"]].map(([k, l]) => (
          <Link key={k} href={k ? `/admin/teams?f=${k}` : "/admin/teams"} className={`chip px-3 py-1.5 ${(f ?? "") === k ? "border-ink bg-ink text-card" : ""}`}>{l}</Link>
        ))}
        <span className="ml-auto self-center text-muted">{rows.length} teams</span>
      </div>
      <ul className="grid gap-4 lg:grid-cols-2">
        {rows.map((t) => (
          <Drop key={t.id} accept="person" mode="admin" targetId={t.id} disabled={!!t.locked_at || t.members.length >= 4} className="panel space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-2xl font-semibold">{t.name}{t.locked_at && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 align-middle text-[11px] uppercase tracking-wider text-card">Locked</span>}</h2>
                <p className="text-sm text-muted">{t.track ?? "No track"} · {t.groups} {t.groups === 1 ? "school" : "schools"}</p>
              </div>
              <SeatPips filled={t.members.length} />
            </div>
            {t.flags.length > 0 && <div className="flex flex-wrap gap-1.5">{t.flags.map((x) => <span key={x} className="chip border-warn text-warn">{x}</span>)}</div>}
            <ul className="divide-y divide-line text-[15px]">
              {t.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <Avatar url={m.avatar_url} name={m.full_name} size={32} />
                  <span className="min-w-0 flex-1 truncate">{m.full_name}<span className="text-muted"> · {school.get(m.school_id)?.name}</span></span>
                  {!m.paid_at && <span className="chip border-warn text-warn">Unpaid</span>}
                  {m.checked_in_at && <span className="chip">In</span>}
                  <ActionButton variant="secondary" confirm={`Remove ${m.full_name} from ${t.name}?`} action={adminRemoveFromTeam.bind(null, m.id)}>Remove</ActionButton>
                </li>
              ))}
              {t.members.length === 0 && <li className="py-2.5 text-muted">No members</li>}
            </ul>
            <div className="flex flex-wrap gap-2">
              <ActionButton variant="secondary" action={adminSetTeamLock.bind(null, t.id, !t.locked_at)}>{t.locked_at ? "Unlock team" : "Lock team"}</ActionButton>
              <ActionButton variant="danger" confirm={`Dissolve ${t.name}? Its members go back to having no team.`} action={adminDissolveTeam.bind(null, t.id)}>Dissolve</ActionButton>
            </div>
          </Drop>
        ))}
      </ul>
      {rows.length === 0 && <p className="panel text-[15px]">No teams match.</p>}
    </DragArea>
  );
}
