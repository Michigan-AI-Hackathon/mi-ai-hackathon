-- Profile additions: pronouns (shown to other students), resume (private, organizers only),
-- and whether the student wants organizers to place them on a team.
alter table public.profiles add column pronouns text check (pronouns is null or char_length(pronouns) <= 30);
alter table public.profiles add column resume_path text check (resume_path is null or char_length(resume_path) <= 300);
alter table public.profiles add column placement_pref text check (placement_pref in ('place_me', 'own_team'));

-- Pronouns appear wherever a name does. Appending at the end keeps `create or replace view` valid.
create or replace view public.student_directory with (security_invoker = off) as
  select p.id, p.full_name, p.school_id, s.name as school_name, public.school_group(p.school_id) as school_group,
         p.study_area, p.skills, p.interests, p.tracks, p.bio, p.looking_for_team, p.linkedin_url,
         tm.team_id, t.name as team_name, p.avatar_url, p.year, p.pronouns
  from public.profiles p
  join public.schools s on s.id = p.school_id
  left join public.team_members tm on tm.user_id = p.id
  left join public.teams t on t.id = tm.team_id
  where p.onboarded_at is not null
    and (p.paid_at is not null or not (select require_payment from public.app_settings limit 1));
grant select on public.student_directory to authenticated;

-- Private bucket for resumes. A student reaches only their own folder; organizers can read all.
-- Resume paths are never part of student_directory, and the bucket is not public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880,
        array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy "resumes: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "resumes: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "resumes: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "resumes: read own or organizer" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
