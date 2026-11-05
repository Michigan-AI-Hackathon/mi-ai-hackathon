"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyMatching, saveMatchingSettings } from "@/app/admin/matching/actions";
import { TRACKS } from "@/lib/config";
import {
  classify, isPresent, mixBroken, previewNotices, resolve, suggest, toPayload,
  type Filters, type Mode, type Move, type NewTeam, type Person, type Settings, type Team, type TeamAfter,
} from "@/lib/matching";

type Tab = "noshow" | "solo" | "incomplete" | "absent" | "valid";
type Choice = "keep" | "mark" | "release";
type Dest = { team: string } | { newTeam: string } | null;

const encode = (d: Dest) => (d ? ("team" in d ? d.team : `new:${d.newTeam}`) : "");
const decode = (v: string): Dest => (!v ? null : v.startsWith("new:") ? { newTeam: v.slice(4) } : { team: v });

export default function MatchingBoard({ people, teams, schools, initial }: {
  people: Person[]; teams: Team[]; schools: { id: number; name: string }[]; initial: Settings;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("pre");
  const [filters, setFilters] = useState<Filters>({ school: null, track: null, checkedInOnly: false });
  const [settings, setSettings] = useState<Settings>(initial);
  const [tab, setTab] = useState<Tab>("solo");
  const [choice, setChoice] = useState<Record<string, Choice>>({});
  const [moves, setMoves] = useState<Move[]>([]);
  const [newTeams, setNewTeams] = useState<NewTeam[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [planKey, setPlanKey] = useState<string | null>(null);
  const [leftover, setLeftover] = useState<string[]>([]);
  const [force, setForce] = useState(false);
  const [notify, setNotify] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [res, setRes] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  const [drag, setDrag] = useState<string | null>(null);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const cohorts = useMemo(() => classify(people, teams, mode, settings, filters), [people, teams, mode, settings, filters]);
  const advices = useMemo(() => suggest(people, teams, { mode }).advice, [people, teams, mode]);
  const key = JSON.stringify([mode, filters, settings.teamSize, settings.trackWeight, Object.entries(choice).filter(([, v]) => v !== "keep").sort()]);
  const stale = planKey !== null && planKey !== key;
  const hasPlan = planKey !== null;

  function runSuggest() {
    const pick = (c: Choice) => Object.entries(choice).filter(([, v]) => v === c).map(([k]) => k);
    const s = suggest(people, teams, { mode, settings, filters, releases: pick("release"), marks: pick("mark"), takenNames: teams.map((t) => t.name) });
    setMoves(s.moves); setNewTeams(s.newTeams); setLeftover(s.leftover);
    setAccepted(new Set(s.moves.map((m) => m.id))); setPlanKey(key); setRes(null); setConfirming(false);
  }

  // ---- editing the plan (drag and drop or the "Move to" menu)
  function assign(student: string, dest: Dest) {
    setMoves((ms) => {
      const rest = ms.filter((m) => !(m.kind === "place" && m.student === student));
      return dest ? [...rest, { id: `place:${student}`, kind: "place", student, to: dest, score: 0, reasons: ["Moved by you"] }] : rest;
    });
    setAccepted((a) => { const n = new Set(a); if (dest) n.add(`place:${student}`); else n.delete(`place:${student}`); return n; });
  }
  const toggle = (id: string) => setAccepted((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  function addNewTeam() { const n = newTeams.length + 1; setNewTeams((t) => [...t, { key: `new-${Date.now()}-${n}`, name: `New team ${n}`, track: null }]); }

  const after = useMemo(() => resolve(people, teams, newTeams, moves, accepted, settings), [people, teams, newTeams, moves, accepted, settings]);
  const touched = new Map(after.map((r) => [r.key, r]));
  // Cards: every team touched by the plan, plus unlocked teams that still have room (so they can be drop targets).
  const cards: TeamAfter[] = [
    ...newTeams.map((nt) => touched.get(nt.key) ?? { key: nt.key, name: nt.name, track: nt.track, isNew: true, locked: false, before: [], after: [], added: [], removed: [], problems: [`Still needs ${settings.teamSize}`], fresh: false }),
    ...teams.filter((t) => !t.locked).flatMap((t) => {
      const r = touched.get(t.id);
      if (r) return [r];
      const m = people.filter((p) => p.teamId === t.id);
      return m.length > 0 && m.length < settings.teamSize ? [{ key: t.id, name: t.name, track: t.track, isNew: false, locked: false, before: m, after: m, added: [], removed: [], problems: [], fresh: false } as TeamAfter] : [];
    }),
  ];
  const options = cards.map((c) => ({ value: encode(c.isNew ? { newTeam: c.key } : { team: c.key }), label: `${c.name}${c.isNew ? " (new)" : ""}` }));
  const placedNow = new Set(moves.filter((m) => m.kind === "place" && accepted.has(m.id)).map((m) => (m as { student: string }).student));
  const unplaced = people.filter((p) => !p.teamId && p.ready && isPresent(p, mode) && !placedNow.has(p.id));
  const acceptedMoves = moves.filter((m) => accepted.has(m.id));
  const needsForce = after.some((r) => mixBroken(r));
  const tooBig = after.some((r) => r.after.length > settings.teamSize);
  const canApply = hasPlan && !stale && acceptedMoves.length > 0 && !tooBig && (!needsForce || (force && initial.allowForce));

  const notices = useMemo(() => (confirming ? previewNotices(toPayload(moves, accepted, newTeams, false), people, teams) : []), [confirming, moves, accepted, newTeams, people, teams]);

  function apply() {
    start(async () => {
      const r = await applyMatching(toPayload(moves, accepted, newTeams, force && needsForce), notify);
      setRes(r);
      if (r?.ok) { setConfirming(false); setMoves([]); setNewTeams([]); setAccepted(new Set()); setPlanKey(null); setChoice({}); router.refresh(); }
      else setConfirming(false);
    });
  }

  const tiles: [Tab, string, number][] = [
    ["noshow", "No-shows", cohorts.noShows.length], ["solo", "Solo, here", cohorts.soloPresent.length],
    ["incomplete", "Incomplete teams", cohorts.incomplete.length], ["absent", "Solo, not here", cohorts.soloAbsent.length], ["valid", "Full teams", cohorts.valid.length],
  ];
  const sel = "input !w-auto";

  return (
    <div className="space-y-6">
      {/* mode + filters */}
      <section className="panel space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Event mode" className="inline-flex rounded-md border border-line p-0.5">
            {([["pre", "Pre-event"], ["day", "Day-of"]] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={mode === v} onClick={() => setMode(v)}
                className={`min-h-11 rounded px-4 text-sm font-semibold ${mode === v ? "bg-ink text-card" : "text-muted hover:text-ink"}`}>{l}</button>
            ))}
          </div>
          <p className="text-sm text-muted">{mode === "pre" ? "Everyone registered counts." : "Only checked-in students count as here."}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label" htmlFor="f-school">Campus</label>
            <select id="f-school" className="input" value={filters.school ?? ""} onChange={(e) => setFilters({ ...filters, school: e.target.value ? Number(e.target.value) : null })}>
              <option value="">All campuses</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>
          <div><label className="label" htmlFor="f-track">Track</label>
            <select id="f-track" className="input" value={filters.track ?? ""} onChange={(e) => setFilters({ ...filters, track: e.target.value || null })}>
              <option value="">All tracks</option>{TRACKS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select></div>
          <label className="flex min-h-11 items-center gap-2 self-end text-[15px]"><input type="checkbox" className="size-5 accent-primary" checked={filters.checkedInOnly} onChange={(e) => setFilters({ ...filters, checkedInOnly: e.target.checked })} />Checked in only</label>
        </div>
      </section>

      {/* cohorts */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" role="tablist" aria-label="Groups">
        {tiles.map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)}
            className={`panel text-left ${tab === k ? "!border-ink shadow-[3px_3px_0_var(--color-text)]" : ""}`}>
            <span className="eyebrow text-muted">{l}</span>
            <span className="mt-2 block font-heading text-3xl font-bold tabular-nums">{n}</span>
          </button>
        ))}
      </div>
      <p className="-mt-3 text-sm text-muted">{cohorts.openSeats} open seats on unlocked teams.{cohorts.notReady > 0 && ` ${cohorts.notReady} more students with no team have an unfinished profile or unpaid fee, so they are not matched.`}</p>

      <section className="panel">
        {tab === "noshow" && (cohorts.noShows.length === 0 ? <Empty>{mode === "pre" ? "No-shows only exist in Day-of mode." : "Everyone on a team is here."}</Empty> : (
          <ul className="divide-y divide-line">
            {cohorts.noShows.map(({ person: p, team }) => {
              const advice = advices[p.id];
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1"><p className="font-semibold">{p.name}</p><p className="text-sm text-muted">{p.school} · on {team.name}{team.locked ? " (locked)" : ""}</p>
                    {!team.locked && <p className="text-sm text-muted">{advice === "release" ? "Someone here could take this seat." : "No one here fits this seat."}</p>}</div>
                  {team.locked ? <span className="chip">Unlock the team to change</span> : (
                    <><label className="sr-only" htmlFor={`c-${p.id}`}>What to do with {p.name}</label>
                    <select id={`c-${p.id}`} className={sel} value={choice[p.id] ?? "keep"} onChange={(e) => setChoice({ ...choice, [p.id]: e.target.value as Choice })}>
                      <option value="keep">Keep seat</option><option value="mark">Mark as no-show</option><option value="release">Release seat</option>
                    </select></>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
        {tab === "solo" && <PersonList list={cohorts.soloPresent} empty="No one without a team is here." />}
        {tab === "absent" && <PersonList list={cohorts.soloAbsent} empty={mode === "pre" ? "In Pre-event mode everyone counts as here." : "No one without a team is missing."} />}
        {tab === "incomplete" && (cohorts.incomplete.length === 0 ? <Empty>No incomplete teams.</Empty> : (
          <ul className="grid gap-3 md:grid-cols-2">{cohorts.incomplete.map((v) => (
            <li key={v.team.id} className="rounded-lg border border-line p-4">
              <p className="font-heading text-lg font-semibold">{v.team.name}{v.team.locked && <span className="chip ml-2">Locked</span>}</p>
              <p className="mt-1 flex flex-wrap gap-1.5">{v.problems.map((x) => <span key={x} className="chip border-warn text-warn">{x}</span>)}</p>
              <ul className="mt-2 text-[15px]">{v.members.map((m) => <li key={m.id} className={isPresent(m, mode) ? "" : "text-muted"}>{m.name} <span className="text-muted">· {m.school}{isPresent(m, mode) ? "" : " · not here"}</span></li>)}</ul>
            </li>))}</ul>
        ))}
        {tab === "valid" && (cohorts.valid.length === 0 ? <Empty>No full teams yet.</Empty> : (
          <ul className="grid gap-3 md:grid-cols-2">{cohorts.valid.map((v) => (
            <li key={v.team.id} className="rounded-lg border border-line p-4">
              <p className="font-heading text-lg font-semibold">{v.team.name}{v.team.locked && <span className="chip ml-2">Locked</span>}</p>
              <p className="text-sm text-muted">{v.members.map((m) => m.name).join(", ")}</p>
            </li>))}</ul>
        ))}
      </section>

      {/* settings */}
      <SettingsPanel initial={initial} value={settings} onChange={(s) => setSettings(s)} />

      {/* suggestions */}
      <section className="panel space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-semibold">Suggestions</h2>
          <button type="button" className="btn-primary ml-auto" onClick={runSuggest}>{hasPlan ? "Suggest again" : "Suggest matches"}</button>
        </div>
        <p className="max-w-2xl text-[15px] text-muted">Fills incomplete teams first, then forms new teams. Existing members stay put. Nothing changes until you press Apply.</p>
        {stale && <p role="status" className="rounded-md border border-warn px-3 py-2 text-sm text-warn">Your filters or choices changed. Press Suggest again before applying.</p>}
        {hasPlan && (
          <>
            <p className="text-[15px]"><strong>{acceptedMoves.filter((m) => m.kind === "place").length}</strong> placements switched on, <strong>{unplaced.length}</strong> students still without a team.</p>
            <div className="grid gap-4 lg:grid-cols-2">
              {cards.map((c) => (
                <TeamCardView key={c.key} card={c} moves={moves} accepted={accepted} byId={byId} options={options} drag={drag} setDrag={setDrag}
                  onToggle={toggle} onAssign={assign} settings={settings}
                  onRename={c.isNew ? (name) => setNewTeams((t) => t.map((x) => (x.key === c.key ? { ...x, name: name.slice(0, 40) } : x))) : undefined} />
              ))}
              <Unplaced list={unplaced} options={options} drag={drag} setDrag={setDrag} onAssign={assign} leftover={leftover} />
            </div>
            <button type="button" className="btn-secondary" onClick={addNewTeam}>Add an empty team</button>
            {moves.filter((m) => m.kind === "mark").length > 0 && (
              <ul className="space-y-1 text-[15px]">{moves.filter((m) => m.kind === "mark").map((m) => (
                <li key={m.id} className="flex items-center gap-3"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="size-5 accent-primary" checked={accepted.has(m.id)} onChange={() => toggle(m.id)} />Mark {byId.get(m.student)?.name} as a no-show <span className="text-muted">(note only, stays on {teamName.get((m as { team: string }).team)})</span></label></li>
              ))}</ul>
            )}

            <div className="space-y-3 border-t border-line pt-4">
              {needsForce && (initial.allowForce
                ? <label className="flex min-h-11 items-center gap-2 text-[15px] text-warn"><input type="checkbox" className="size-5 accent-primary" checked={force} onChange={(e) => setForce(e.target.checked)} />A team breaks the school rule. Ignore it for this apply.</label>
                : <p role="alert" className="text-sm text-danger">A team breaks the school rule. Fix it, or allow ignoring the rule in Settings.</p>)}
              {tooBig && <p role="alert" className="text-sm text-danger">A team has more than {settings.teamSize} people.</p>}
              <label className="flex min-h-11 items-center gap-2 text-[15px]"><input type="checkbox" className="size-5 accent-primary" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Post a welcome in each affected team&apos;s chat (existing teammates are told who joined and why){acceptedMoves.some((m) => m.kind === "release") ? ", and send released students a short note" : ""}</label>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn-primary" disabled={!canApply || pending} onClick={() => setConfirming(true)}>Apply selected ({acceptedMoves.length})</button>
                {res?.error && <span role="alert" className="text-sm text-danger">{res.error}</span>}
              </div>
            </div>
          </>
        )}
        {res?.ok && <p role="status" className="text-sm text-ok">{res.ok}</p>}
      </section>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Confirm changes">
          <div className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-xl bg-card p-5 sm:rounded-xl sm:p-6">
            <h2 className="font-heading text-2xl font-semibold">Apply these changes?</h2>
            <ul className="mt-4 space-y-3 text-[15px]">
              {after.filter((r) => r.added.length || r.removed.length).map((r) => (
                <li key={r.key} className="rounded-md border border-line p-3">
                  <p className="font-semibold">{r.name}{r.isNew && <span className="chip ml-2">New team</span>}</p>
                  <p className="text-muted">Before: {r.before.map((p) => p.name).join(", ") || "none"}</p>
                  <p>After: {r.after.map((p) => p.name).join(", ") || "none"}</p>
                  {r.removed.length > 0 && <p className="text-warn">Seat released: {r.removed.map((p) => p.name).join(", ")}</p>}
                </li>
              ))}
              {acceptedMoves.filter((m) => m.kind === "mark").map((m) => <li key={m.id} className="text-muted">Mark {byId.get(m.student)?.name} as a no-show (no team change)</li>)}
            </ul>
            <label className="mt-4 flex min-h-11 items-center gap-2 text-[15px]"><input type="checkbox" className="size-5 accent-primary" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Send team-chat messages for these placements</label>
            {notify && notices.length > 0 && (
              <div className="mt-2 space-y-2 rounded-md border border-line p-3 text-sm">
                <p className="font-semibold">Messages teams will see in Messages{notices.length > 1 ? ` (example for ${notices[0].team}; the others use the same wording)` : ""}</p>
                {notices.slice(0, 3).map((n) => (
                  <div key={n.team}><p className="text-muted">{n.team}{n.isNew ? " (new team)" : ""}</p>
                    {n.messages.map((m, i) => <p key={i} className="mt-1 rounded bg-card px-2 py-1">{m}</p>)}</div>
                ))}
                {notices.length > 3 && <p className="text-muted">and {notices.length - 3} more teams</p>}
              </div>
            )}
            <p className="mt-3 text-sm text-muted">{notify ? `Placed students and their teammates get these in Messages.` : "No team-chat messages will be sent."} Every change is saved to the audit log.{force && needsForce ? " School rules are ignored for this apply." : ""}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="btn-primary" disabled={pending} onClick={apply}>{pending ? "Applying…" : "Apply now"}</button>
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) { return <p className="text-[15px] text-muted">{children}</p>; }

function PersonList({ list, empty }: { list: Person[]; empty: string }) {
  if (list.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="grid gap-x-6 md:grid-cols-2">
      {list.slice(0, 200).map((p) => (
        <li key={p.id} className="border-b border-line py-3">
          <p className="font-semibold">{p.name}{p.checkedIn && <span className="chip ml-2">In</span>}</p>
          <p className="text-sm text-muted">{p.school}{p.tracks.length ? ` · ${p.tracks.join(", ")}` : ""}</p>
          {p.skills.length > 0 && <p className="text-sm text-muted">{p.skills.join(", ")}</p>}
        </li>
      ))}
      {list.length > 200 && <li className="py-3 text-sm text-muted">Showing 200 of {list.length}. Use the filters to narrow it.</li>}
    </ul>
  );
}

function SettingsPanel({ initial, value, onChange }: { initial: Settings; value: Settings; onChange: (s: Settings) => void }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ error?: string; ok?: string } | null>(null);
  const [allow, setAllow] = useState(initial.allowForce);
  return (
    <details className="panel">
      <summary className="flex min-h-11 cursor-pointer items-center font-heading text-xl font-semibold">Settings</summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div><label className="label" htmlFor="s-size">Team size</label>
          <select id="s-size" className="input" value={value.teamSize} onChange={(e) => onChange({ ...value, teamSize: Number(e.target.value) })}>
            <option value={4}>4 (needed to lock in)</option><option value={3}>3</option></select></div>
        <div><label className="label" htmlFor="s-w">Same-track weight: {value.trackWeight}</label>
          <input id="s-w" type="range" min={0} max={10} step={0.5} className="h-11 w-full accent-primary" value={value.trackWeight} onChange={(e) => onChange({ ...value, trackWeight: Number(e.target.value) })} /></div>
        <label className="flex min-h-11 items-center gap-2 self-end text-[15px]"><input type="checkbox" className="size-5 accent-primary" checked={allow} onChange={(e) => setAllow(e.target.checked)} />Allow ignoring the school rule</label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" disabled={pending} onClick={() => start(async () => setRes(await saveMatchingSettings(value.teamSize, allow, value.trackWeight)))}>{pending ? "Saving…" : "Save settings"}</button>
        {res?.error && <span role="alert" className="text-sm text-danger">{res.error}</span>}
        {res?.ok && <span role="status" className="text-sm text-ok">{res.ok}</span>}
      </div>
    </details>
  );
}

function dropProps(enabled: boolean, onDrop: (id: string) => void, setDrag: (v: string | null) => void) {
  return {
    onDragOver: (e: React.DragEvent) => { if (enabled) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); setDrag(null);
      if (!enabled) return;
      try { const d = JSON.parse(e.dataTransfer.getData("text/plain")) as { kind: string; id: string }; if (d.kind === "student") onDrop(d.id); } catch { /* not ours */ }
    },
  };
}
const dragProps = (id: string, setDrag: (v: string | null) => void) => ({
  draggable: true,
  onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "student", id })); e.dataTransfer.effectAllowed = "move"; setDrag(id); },
  onDragEnd: () => setDrag(null),
});

type Opt = { value: string; label: string };
function MoveSelect({ id, name, options, current, onChange }: { id: string; name: string; options: Opt[]; current: string; onChange: (d: Dest) => void }) {
  return (
    <>
      <label className="sr-only" htmlFor={`mv-${id}`}>Move {name} to</label>
      <select id={`mv-${id}`} className="input !w-auto max-w-[11rem]" value={current} onChange={(e) => onChange(decode(e.target.value))}>
        <option value="">No team</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </>
  );
}

function TeamCardView({ card, moves, accepted, byId, options, drag, setDrag, onToggle, onAssign, onRename, settings }: {
  card: TeamAfter; moves: Move[]; accepted: Set<string>; byId: Map<string, Person>; options: Opt[]; drag: string | null;
  setDrag: (v: string | null) => void; onToggle: (id: string) => void; onAssign: (s: string, d: Dest) => void; onRename?: (n: string) => void; settings: Settings;
}) {
  const [over, setOver] = useState(false);
  const dest: Dest = card.isNew ? { newTeam: card.key } : { team: card.key };
  const mine = moves.filter((m) => (m.kind === "place" && ("team" in m.to ? m.to.team === card.key : m.to.newTeam === card.key)) || (m.kind === "release" && m.team === card.key));
  const live = drag !== null;
  const rule = mixBroken(card);
  return (
    <div {...dropProps(true, (id) => { setOver(false); onAssign(id, dest); }, setDrag)} onDragEnter={() => setOver(true)} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      className={`rounded-lg border bg-paper p-4 transition-all ${over ? "border-accent ring-2 ring-accent" : live ? "border-dashed border-accent" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-2">
        {onRename ? <><label className="sr-only" htmlFor={`n-${card.key}`}>Team name</label><input id={`n-${card.key}`} className="input !w-auto min-w-0 flex-1 font-semibold" value={card.name} onChange={(e) => onRename(e.target.value)} maxLength={40} /></>
          : <h3 className="font-heading text-lg font-semibold">{card.name}</h3>}
        {card.isNew && <span className="chip">New</span>}
        <span className="ml-auto text-sm tabular-nums text-muted">{card.after.length} / {settings.teamSize}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{card.track ?? "No track"}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div><p className="eyebrow text-muted">Before</p>
          <ul className="mt-1 text-[15px]">{card.before.map((p) => <li key={p.id}>{p.name}<span className="block text-xs text-muted">{p.school}</span></li>)}{card.before.length === 0 && <li className="text-muted">Empty</li>}</ul></div>
        <div><p className="eyebrow text-muted">After</p>
          <ul className="mt-1 text-[15px]">{card.after.map((p) => <li key={p.id} className={card.added.includes(p) ? "font-semibold" : ""}>{p.name}<span className="block text-xs text-muted">{p.school}</span></li>)}</ul></div>
      </div>
      {card.problems.length > 0 && <p className="mt-3 flex flex-wrap gap-1.5">{card.problems.map((x) => <span key={x} className={`chip ${rule ? "border-danger text-danger" : "border-warn text-warn"}`}>{x}</span>)}</p>}
      {mine.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {mine.map((m) => {
            const p = byId.get(m.student); if (!p) return null;
            const on = accepted.has(m.id);
            return (
              <li key={m.id} {...(m.kind === "place" ? dragProps(p.id, setDrag) : {})} className={`flex flex-wrap items-center gap-2 py-2 ${m.kind === "place" ? "cursor-grab" : ""} ${on ? "" : "opacity-50"}`}>
                <div className="min-w-0 flex-1 text-[15px]">
                  <p>{m.kind === "release" ? "Release " : "Add "}<strong>{p.name}</strong></p>
                  <p className="text-xs text-muted">{m.kind === "release" ? "Not checked in" : `${p.school} · ${(m as { reasons: string[] }).reasons.join(" · ") || "Open seat"}`}</p>
                </div>
                {m.kind === "place" && <MoveSelect id={p.id} name={p.name} options={options} current={encode(dest)} onChange={(d) => onAssign(p.id, d)} />}
                <button type="button" aria-pressed={on} className={on ? "btn-secondary" : "btn-primary"} onClick={() => onToggle(m.id)}>{on ? "Reject" : "Accept"}</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Unplaced({ list, options, drag, setDrag, onAssign, leftover }: {
  list: Person[]; options: Opt[]; drag: string | null; setDrag: (v: string | null) => void; onAssign: (s: string, d: Dest) => void; leftover: string[];
}) {
  const left = new Set(leftover);
  return (
    <div {...dropProps(true, (id) => onAssign(id, null), setDrag)} className={`rounded-lg border bg-paper p-4 ${drag ? "border-dashed border-accent" : "border-line"}`}>
      <h3 className="font-heading text-lg font-semibold">No team <span className="text-muted">({list.length})</span></h3>
      <p className="text-sm text-muted">Drag a student onto a team, or use the menu. Drop here to take them off a team.</p>
      <ul className="mt-2 max-h-80 divide-y divide-line overflow-y-auto">
        {list.map((p) => (
          <li key={p.id} {...dragProps(p.id, setDrag)} className="flex cursor-grab flex-wrap items-center gap-2 py-2">
            <div className="min-w-0 flex-1 text-[15px]"><p>{p.name}</p><p className="text-xs text-muted">{p.school}{left.has(p.id) ? " · no valid team" : ""}</p></div>
            <MoveSelect id={p.id} name={p.name} options={options} current="" onChange={(d) => onAssign(p.id, d)} />
          </li>
        ))}
        {list.length === 0 && <li className="py-2 text-[15px] text-muted">Everyone present has a team.</li>}
      </ul>
    </div>
  );
}
