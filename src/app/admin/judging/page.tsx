import Link from "next/link";
import ActionButton from "@/components/ActionButton";
import PageHeader from "@/components/PageHeader";
import { AddJudgeForm, JudgeAssign, RubricEditor, TeamNumberInput } from "@/components/admin/JudgingForms";
import { requireAdmin } from "@/lib/admin";
import { TRACKS } from "@/lib/config";
import { judgeLabel, label, type JudgingData } from "@/lib/judging";
import { autoNumber, removeJudge } from "./actions";

export default async function JudgingSetup() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_judging_data");
  if (error || !data) return <p className="panel text-danger" role="alert">Could not load judging. {error?.message}</p>;
  const d = data as JudgingData;
  const criteria = d.criteria.filter((c) => c.active);
  const teamOpts = d.teams.map((t) => ({ id: t.id, label: label(t) + (t.track ? ` · ${t.track}` : "") }));
  const allTracks = [...new Set<string>([...TRACKS, ...d.teams.map((t) => t.track).filter(Boolean) as string[]])];
  const unnumbered = d.teams.filter((t) => t.number == null).length;

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Judging" title="Judging setup">
        Judging happens in person. Set the rubric, number the teams, and tell each judge which teams to score. They sign in at <code>/judge</code>.
      </PageHeader>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="chip border-ink bg-ink px-3 py-1.5 text-card">Setup</span>
        <Link href="/admin/judging/results" className="chip px-3 py-1.5">Results</Link>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl font-semibold">1. Scoring rubric</h2>
        <RubricEditor initial={criteria} />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl font-semibold">2. Team numbers</h2>
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton variant="secondary" action={autoNumber.bind(null, false)}>Number the {unnumbered} unnumbered teams</ActionButton>
          <ActionButton variant="secondary" confirm="Renumber every team from 1? Numbers already handed out will change." action={autoNumber.bind(null, true)}>Renumber all (by track)</ActionButton>
        </div>
        <div className="panel"><ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.teams.map((t) => (
            <li key={t.id} className="flex items-start gap-3"><TeamNumberInput team={t.id} value={t.number} />
              <span className="min-w-0 pt-2 text-[15px]"><span className="font-semibold">{t.name}</span><span className="block text-sm text-muted">{t.track ?? "No track"} · {t.members} people</span></span></li>
          ))}
          {d.teams.length === 0 && <li className="text-muted">No teams yet.</li>}
        </ul></div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl font-semibold">3. Judges</h2>
        <p className="max-w-2xl text-[15px] text-muted">Add a judge by email, then choose the tracks they cover (for example, a Rocket Money judge gets FinTech) and/or specific teams. A judge sees only what you assign them, and only their own scores.</p>
        <AddJudgeForm />
        <ul className="space-y-4">
          {d.judges.map((j) => (
            <li key={j.id} className="panel space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-xl font-semibold">{judgeLabel(j)}{j.org && <span className="text-muted"> · {j.org}</span>}</h3>
                  <p className="text-sm text-muted">{j.email} · {j.signed_in ? "has signed in" : "not signed in yet"}</p>
                </div>
                <ActionButton variant="danger" confirm={`Remove ${judgeLabel(j)}? Their scores are deleted too.`} action={removeJudge.bind(null, j.id)}>Remove</ActionButton>
              </div>
              <JudgeAssign judge={j.id} allTracks={allTracks} teams={teamOpts} tracks={j.tracks} teamIds={j.teams} />
            </li>
          ))}
          {d.judges.length === 0 && <li className="panel text-[15px] text-muted">No judges yet.</li>}
        </ul>
      </section>
    </div>
  );
}
