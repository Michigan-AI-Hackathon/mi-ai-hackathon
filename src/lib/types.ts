export type Student = {
  id: string; full_name: string; school_id: number; school_name: string; school_group: string;
  study_area: string | null; skills: string[]; interests: string[]; tracks: string[]; bio: string | null;
  looking_for_team: boolean; linkedin_url: string | null; team_id: string | null; team_name: string | null;
};
