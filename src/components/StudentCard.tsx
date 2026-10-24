import Link from "next/link";
import StudentActions from "@/components/StudentActions";
import type { Student } from "@/lib/types";

export default function StudentCard({ s, myTeamId, myTeamLocked, canAct }: { s: Student; myTeamId: string | null; myTeamLocked: boolean; canAct: boolean }) {
  return (
    <li className="panel flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Link href={`/people/${s.id}`} className="font-heading text-xl font-semibold hover:text-primary">{s.full_name}</Link>
          <span className={`text-sm ${s.team_id ? "text-muted" : "font-medium text-ok"}`}>
            {s.team_id ? `On ${s.team_name}` : s.looking_for_team ? "Looking for a team" : "No team yet"}
          </span>
        </div>
        <p className="mt-0.5 text-[15px] text-muted">{s.school_name}{s.study_area ? `, ${s.study_area}` : ""}</p>
      </div>
      {s.bio && <p className="line-clamp-3 text-[15px] leading-relaxed">{s.bio}</p>}
      {(s.tracks.length > 0 || s.skills.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {s.tracks.map((t) => <span key={t} className="chip border-primary/30 bg-primary/5 font-medium">{t}</span>)}
          {s.skills.slice(0, 6).map((k) => <span key={k} className="chip">{k}</span>)}
        </div>
      )}
      <div className="mt-auto">
        <StudentActions studentId={s.id} theirTeamId={s.team_id} myTeamId={myTeamId} myTeamLocked={myTeamLocked} canAct={canAct} />
      </div>
    </li>
  );
}
