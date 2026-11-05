import Link from "next/link";
import Avatar from "@/components/Avatar";
import { Drag } from "@/components/DragDrop";
import StudentActions from "@/components/StudentActions";
import type { Student } from "@/lib/types";

// The whole card opens the profile (the name link stretches over it); the action buttons sit above that layer.
export default function StudentCard({ s, myTeamId, myTeamLocked, canAct, draggable = false }: { s: Student; myTeamId: string | null; myTeamLocked: boolean; canAct: boolean; draggable?: boolean }) {
  return (
    <Drag as="li" kind="person" id={s.id} disabled={!draggable} tap className="group panel tap-card rise relative flex flex-col gap-4">
      <div className="flex gap-3">
        <Avatar url={s.avatar_url} name={s.full_name} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Link href={`/people/${s.id}`} draggable={false} className="font-heading text-xl font-semibold text-primary underline-offset-4 after:absolute after:inset-0 after:z-0 after:content-[''] group-hover:underline">{s.full_name}</Link>
            <span className={`text-sm ${s.team_id ? "text-muted" : "font-medium text-ok"}`}>
              {s.team_id ? `On ${s.team_name}` : s.looking_for_team ? "Looking for a team" : "No team yet"}
            </span>
          </div>
          <p className="mt-0.5 text-[15px] text-muted">{s.school_name}{s.study_area ? `, ${s.study_area}` : ""}</p>
        </div>
      </div>
      {s.bio && <p className="line-clamp-3 text-[15px] leading-relaxed">{s.bio}</p>}
      {(s.tracks.length > 0 || s.skills.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {s.tracks.map((t) => <span key={t} className="chip border-primary/30 bg-primary/5 font-medium">{t}</span>)}
          {s.skills.slice(0, 6).map((k) => <span key={k} className="chip">{k}</span>)}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <div className="relative z-10"><StudentActions studentId={s.id} theirTeamId={s.team_id} myTeamId={myTeamId} myTeamLocked={myTeamLocked} canAct={canAct} /></div>
        <span aria-hidden className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-md border border-line px-3 text-sm font-semibold text-primary transition-colors group-hover:border-primary group-hover:bg-primary/5">View profile <span className="transition-transform group-hover:translate-x-0.5">›</span></span>
      </div>
    </Drag>
  );
}
