import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { loadJudgeData, scoredCount } from "@/lib/judge-data";

export default async function JudgeHome() {
  const { judge, criteria, teams } = await loadJudgeData();
  const done = teams.filter((t) => criteria.length > 0 && scoredCount(t, criteria) === criteria.length).length;
  return (
    <div>
      <PageHeader eyebrow="Judging" title={`Hi${judge.name ? `, ${judge.name.split(" ")[0]}` : ""}`}>
        {teams.length > 0 ? `You have ${teams.length} ${teams.length === 1 ? "team" : "teams"} to score (${done} done). Only you can see your scores.` : "No teams have been assigned to you yet. An organizer will add them."}
      </PageHeader>
      {criteria.length === 0 && teams.length > 0 && <p className="panel mb-4 text-[15px]">The scoring rubric is not set up yet. Check back soon.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {teams.map((t) => {
          const n = scoredCount(t, criteria);
          const complete = criteria.length > 0 && n === criteria.length;
          return (
            <li key={t.id}>
              <Link href={`/judge/${t.id}`} className="panel block min-h-24 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-heading text-xl font-semibold">{t.number != null && <span className="mr-2 font-mono text-primary">#{t.number}</span>}{t.name}</h2>
                  <span className={`chip shrink-0 ${complete ? "border-ok text-ok" : n > 0 ? "border-warn text-warn" : ""}`}>{complete ? "Scored" : n > 0 ? `${n}/${criteria.length}` : "Not scored"}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{t.track ?? "No track"}</p>
                <p className="mt-2 text-sm">{t.members.map((m) => m.name).join(", ") || "No members"}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
