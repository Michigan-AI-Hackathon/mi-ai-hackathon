-- 1. UM Ann Arbor, Dearborn and Flint count as separate schools for the team rules
--    (students who don't take classes together are not "the same school").
update public.schools set rule_group = null where rule_group = 'umich';

-- 2. A team must have all 4 people to lock in (3+ schools is guaranteed by the add rules).
create or replace function public.team_lock_problem(p_team uuid)
returns text language plpgsql stable security definer set search_path = public
as $$
declare v_size int; v_groups int; v_unpaid int;
begin
  select count(*), count(distinct public.school_group(p.school_id)),
         count(*) filter (where p.paid_at is null)
    into v_size, v_groups, v_unpaid
  from public.team_members tm join public.profiles p on p.id = tm.user_id
  where tm.team_id = p_team;

  if v_size < 4 then
    return 'You need 4 people to lock in. Your team has ' || v_size || '.';
  end if;
  if v_groups < 3 then return 'A team of 4 needs people from at least 3 schools.'; end if;
  if (public.settings()).require_payment and v_unpaid > 0 then
    return 'Everyone on the team has to pay the registration fee before you can lock in.';
  end if;
  return null;
end $$;

-- 3. A team can only have as many open invites as it has open spots.
create or replace function public.send_invite(p_student uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_team uuid := public.my_team_id(); v_problem text; v_id uuid; v_open int; v_size int;
begin
  perform public.expire_old_invites();
  if v_team is null then raise exception 'Create or join a team before inviting people.'; end if;
  if (select locked_at from public.teams where id = v_team) is not null then
    raise exception 'Your team is locked in.'; end if;
  if p_student = auth.uid() then raise exception 'You cannot invite yourself.'; end if;
  perform public.require_ready_student(p_student);
  if exists (select 1 from public.team_members where user_id = p_student) then
    raise exception 'That student is already on a team.'; end if;
  v_problem := public.team_add_problem(v_team, p_student);
  if v_problem is not null then raise exception '%', v_problem; end if;
  select count(*) into v_size from public.team_members where team_id = v_team;
  select count(*) into v_open from public.invites
   where team_id = v_team and status = 'pending' and kind = 'invite';
  if v_open >= 4 - v_size then
    raise exception 'You have % open % for % open %. Wait for answers or cancel one.',
      v_open, case when v_open = 1 then 'invite' else 'invites' end,
      4 - v_size, case when 4 - v_size = 1 then 'spot' else 'spots' end;
  end if;
  insert into public.invites (team_id, student_id, kind, sent_by, expires_at)
  values (v_team, p_student, 'invite', auth.uid(), now() + make_interval(hours => (public.settings()).invite_hours))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'There is already an open invite between you and that student.';
end $$;

-- 4. Optional avatar: one of four presets ('preset-1'..'preset-4') or an uploaded image URL.
alter table public.profiles add column avatar_url text;
alter table public.profiles add constraint avatar_url_format
  check (avatar_url is null or avatar_url ~ '^preset-[1-4]$' or avatar_url ~ '^https://');

create or replace view public.student_directory with (security_invoker = off) as
  select p.id, p.full_name, p.school_id, s.name as school_name, public.school_group(p.school_id) as school_group,
         p.study_area, p.skills, p.interests, p.tracks, p.bio, p.looking_for_team, p.linkedin_url,
         tm.team_id, t.name as team_name, p.avatar_url
  from public.profiles p
  join public.schools s on s.id = p.school_id
  left join public.team_members tm on tm.user_id = p.id
  left join public.teams t on t.id = tm.team_id
  where p.onboarded_at is not null
    and (p.paid_at is not null or not (select require_payment from public.app_settings limit 1));
grant select on public.student_directory to authenticated;
