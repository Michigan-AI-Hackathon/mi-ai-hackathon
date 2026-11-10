-- Help requests are answered in the app: the organizer's reply lands in the student's Messages ("Organizers").
alter table public.help_requests
  add column replied_at timestamptz,
  add column reply      text,
  add column replied_by uuid references public.profiles(id) on delete set null;

create or replace function public.admin_reply_help(p_id uuid, p_reply text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_user uuid; v_reply text := trim(coalesce(p_reply, ''));
begin
  perform public.require_admin();
  if char_length(v_reply) < 2 then raise exception 'Write a reply.'; end if;
  select user_id into v_user from public.help_requests where id = p_id;
  if v_user is null then raise exception 'Request not found.'; end if;
  perform public.admin_post_announcement(array[v_user], 'Reply to your help request', left(v_reply, 1800));
  update public.help_requests set reply = left(v_reply, 1800), replied_at = now(), replied_by = auth.uid() where id = p_id;
end $$;

-- Mark handled without writing back (e.g. solved in person).
create or replace function public.admin_resolve_help(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  update public.help_requests set replied_at = coalesce(replied_at, now()), replied_by = coalesce(replied_by, auth.uid()) where id = p_id;
end $$;

revoke all on function public.admin_reply_help(uuid, text) from public, anon;
revoke all on function public.admin_resolve_help(uuid) from public, anon;
grant execute on function public.admin_reply_help(uuid, text) to authenticated;
grant execute on function public.admin_resolve_help(uuid) to authenticated;

-- Organizers and judges are not participants: keep them out of every teammate-finding list.
create or replace view public.student_directory with (security_invoker = off) as
  select p.id, p.full_name, p.school_id, s.name as school_name, public.school_group(p.school_id) as school_group,
         p.study_area, p.skills, p.interests, p.tracks, p.bio, p.looking_for_team, p.linkedin_url,
         tm.team_id, t.name as team_name, p.avatar_url, p.year, p.pronouns
  from public.profiles p
  join public.schools s on s.id = p.school_id
  left join public.team_members tm on tm.user_id = p.id
  left join public.teams t on t.id = tm.team_id
  where p.onboarded_at is not null
    and not p.is_admin
    and not exists (select 1 from public.judges j where j.email = lower(p.email))
    and (p.paid_at is not null or not (select require_payment from public.app_settings limit 1));
grant select on public.student_directory to authenticated;

-- Security hardening from the audit.
-- A resume path must live in the owner's own folder (the app checks too, but PostgREST can write profiles directly).
alter table public.profiles add constraint profiles_resume_path_own_folder
  check (resume_path is null or (resume_path like id::text || '/%' and resume_path !~ '\.\.'));
-- If a resumes bucket already existed as public, force it private.
update storage.buckets set public = false where id = 'resumes';

-- A judge never scores a team they are a member of.
create or replace function public._judge_can_see(p_judge uuid, p_team uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select (exists (select 1 from public.judge_teams where judge_id = p_judge and team_id = p_team)
       or exists (select 1 from public.judge_tracks jt join public.teams t on t.track = jt.track
                   where jt.judge_id = p_judge and t.id = p_team))
     and not exists (select 1 from public.team_members tm
                       join public.profiles p on p.id = tm.user_id
                       join public.judges j on lower(p.email) = j.email
                      where tm.team_id = p_team and j.id = p_judge);
$$;
revoke all on function public._judge_can_see(uuid, uuid) from public, anon, authenticated;

-- Switched-off prizes cannot be redeemed.
create or replace function public.admin_redeem_prize(p_user uuid, p_prize uuid, p_note text default null)
returns int language plpgsql security definer set search_path = public
as $$
declare z public.prizes; v_bal int;
begin
  perform public.require_admin();
  select * into z from public.prizes where id = p_prize;
  if z.id is null then raise exception 'Pick a prize.'; end if;
  if not z.active then raise exception 'That prize is switched off.'; end if;
  perform 1 from public.profiles where id = p_user for update;
  if not found then raise exception 'Student not found.'; end if;
  v_bal := public._points_balance(p_user);
  if v_bal < z.cost then raise exception 'Not enough points: they have %, the prize costs %.', v_bal, z.cost; end if;
  insert into public.prize_redemptions (user_id, prize_id, label, points, note, by_admin)
  values (p_user, z.id, z.name, z.cost, left(trim(coalesce(p_note, '')), 200), auth.uid());
  perform public.log_admin('prize_redeemed', jsonb_build_object('student', p_user, 'prize', z.name, 'cost', z.cost));
  return v_bal - z.cost;
end $$;
