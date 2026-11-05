import { Skeleton } from "skullet/react";
import StudentCard from "@/components/StudentCard";
import { SkPage, SkHeader, Sk } from "@/components/Skeleton";
import type { Student } from "@/lib/types";

const SAMPLE: Student = {
  id: "sample", full_name: "Alex Johnson", school_id: 1, school_name: "University of Michigan", school_group: "um",
  study_area: "Computer Science", skills: ["Python", "Design", "React"], interests: [], tracks: ["Health"],
  bio: "Building things with data and trying to ship something real in 24 hours.",
  looking_for_team: true, linkedin_url: null, team_id: null, team_name: null, avatar_url: null,
};

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <Sk className="mb-6 h-11 w-full max-w-md" />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} loading id="person-card">
            <StudentCard s={SAMPLE} myTeamId={null} myTeamLocked={false} canAct={false} />
          </Skeleton>
        ))}
      </ul>
    </SkPage>
  );
}
