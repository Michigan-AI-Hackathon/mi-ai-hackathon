import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ScoreForm from "@/components/judge/ScoreForm";
import { loadJudgeData } from "@/lib/judge-data";

export default async function JudgeTeam({ params }: { params: Promise<{ team: string }> }) {
  const { team: id } = await params;
  const { criteria, teams } = await loadJudgeData();
  const i = teams.findIndex((t) => t.id === id);
  if (i < 0) notFound(); // not assigned to this judge
  const t = teams[i];
  const next = teams[i + 1];
  return (
    <div className="space-y-6">
      <Link href="/judge" className="link-draw inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">← My teams</Link>
      <PageHeader eyebrow={t.track ?? "No track"} title={<>{t.number != null && <span className="mr-2 font-mono text-primary">#{t.number}</span>}{t.name}</>} className="!mb-2" />
      <section className="panel">
        <h2 className="font-heading text-lg font-semibold">Team</h2>
        <ul className="mt-2 divide-y divide-line text-[15px]">
          {t.members.map((m, k) => <li key={k} className="py-2">{m.name}{m.school && <span className="text-muted"> · {m.school}</span>}</li>)}
          {t.members.length === 0 && <li className="py-2 text-muted">No members</li>}
        </ul>
      </section>
      <ScoreForm key={t.id} team={t.id} criteria={criteria} initialScores={t.scores} initialComment={t.comment ?? ""} nextHref={next ? `/judge/${next.id}` : "/judge"} nextLabel={next ? "Save and go to next team" : "Save and finish"} />
    </div>
  );
}
