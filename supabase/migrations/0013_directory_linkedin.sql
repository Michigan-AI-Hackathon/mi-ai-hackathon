-- Profile pages show everything a student filled in during onboarding.
-- linkedin_url is already exposed by student_directory (0005). Year of study was not, so add it.
-- Appending a column at the end keeps `create or replace view` valid.
create or replace view public.student_directory with (security_invoker = off) as
  select p.id, p.full_name, p.school_id, s.name as school_name, public.school_group(p.school_id) as school_group,
         p.study_area, p.skills, p.interests, p.tracks, p.bio, p.looking_for_team, p.linkedin_url,
         tm.team_id, t.name as team_name, p.avatar_url, p.year
  from public.profiles p
  join public.schools s on s.id = p.school_id
  left join public.team_members tm on tm.user_id = p.id
  left join public.teams t on t.id = tm.team_id
  where p.onboarded_at is not null
    and (p.paid_at is not null or not (select require_payment from public.app_settings limit 1));
grant select on public.student_directory to authenticated;
