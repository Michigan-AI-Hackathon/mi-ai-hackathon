-- =====================================================================
-- 1. Team leader: the person who made the team. Only they can lock it in.
-- 2. Last active: when a student last used the app, so organizers can spot people who went quiet.
-- 3. Leave the hackathon: a student can delete their own account (team seat, invites and data go with it).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Leader
-- ---------------------------------------------------------------------
alter table public.teams add column leader_id uuid references public.profiles(id) on delete set null;

update public.teams t set leader_id = coalesce(
  (select tm.user_id from public.team_members tm where tm.team_id = t.id and tm.user_id = t.created_by),
  (select tm.user_id from public.team_members tm where tm.team_id = t.id order by tm.joined_at, tm.user_id limit 1));

-- Every way of joining a team (create, accept, organizer placement, matching) inserts a team_members row,
-- so one trigger covers them all: the first person in is the leader.
create or replace function public._leader_on_join()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.teams set leader_id = new.user_id where id = new.team_id and leader_id is null;
  return new;
end $$;
create trigger team_leader_on_join after insert on public.team_members
  for each row execute function public._leader_on_join();

-- When the leader leaves (or is removed, or deletes their account) the longest-standing member takes over.
create or replace function public._leader_on_leave()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.teams set leader_id = (
    select tm.user_id from public.team_members tm where tm.team_id = old.team_id order by tm.joined_at, tm.user_id limit 1)
   where id = old.team_id and (leader_id = old.user_id or leader_id is null);
  return old;
end $$;
create trigger team_leader_on_leave after delete on public.team_members
  for each row execute function public._leader_on_leave();

-- Hand the lead to someone else on your team.
create or replace function public.set_team_leader(p_user uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_team uuid := public.my_team_id();
begin
  if v_team is null then raise exception 'You are not on a team.'; end if;
  if (select leader_id from public.teams where id = v_team) is distinct from auth.uid() then
    raise exception 'Only your team leader can do that.'; end if;
  if not exists (select 1 from public.team_members where team_id = v_team and user_id = p_user) then
    raise exception 'That person is not on your team.'; end if;
  update public.teams set leader_id = p_user where id = v_team;
end $$;

-- Only the leader can lock the team in (same checks as before).
create or replace function public.lock_team()
returns void language plpgsql security definer set search_path = public
as $$
declare v_team uuid := public.my_team_id(); v_problem text;
begin
  if v_team is null then raise exception 'You are not on a team.'; end if;
  if (select leader_id from public.teams where id = v_team) is distinct from auth.uid() then
    raise exception 'Only your team leader can lock in the team.'; end if;
  v_problem := public.team_lock_problem(v_team);
  if v_problem is not null then raise exception '%', v_problem; end if;
  update public.teams set locked_at = now() where id = v_team and locked_at is null;
  update public.invites set status = 'cancelled', responded_at = now()
   where team_id = v_team and status = 'pending';
end $$;

-- ---------------------------------------------------------------------
-- 2. Last active
-- ---------------------------------------------------------------------
alter table public.profiles add column last_active_at timestamptz;

-- Students can't write it themselves; only touch_active() (below) does.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user in ('authenticated','anon') then
    new.email := old.email;  new.is_admin := old.is_admin;
    new.paid_at := old.paid_at;  new.created_at := old.created_at;
    new.checked_in_at := old.checked_in_at;  new.signup_source := old.signup_source;
    new.last_active_at := old.last_active_at;
    if new.school_id is distinct from old.school_id and new.school_id is not null
       and not exists (select 1 from public.schools_for_email(old.email) s where s.id = new.school_id) then
      raise exception 'That school does not match your email.';
    end if;
    if new.school_id is distinct from old.school_id
       and exists (select 1 from public.team_members where user_id = old.id) then
      raise exception 'Leave your team before changing schools.';
    end if;
  end if;
  return new;
end $$;

-- Called as people use the app. Writes at most once every 10 minutes per person.
create or replace function public.touch_active()
returns void language sql security definer set search_path = public
as $$
  update public.profiles set last_active_at = now()
   where id = auth.uid() and (last_active_at is null or last_active_at < now() - interval '10 minutes');
$$;

-- ---------------------------------------------------------------------
-- 3. Leave the hackathon
-- ---------------------------------------------------------------------
-- Payments are our accounting record (and what a sponsoring school is invoiced from), so they stay
-- when the person goes. Everything else about them is deleted with the account.
alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint payments_user_id_fkey;
alter table public.payments add constraint payments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

-- Step one of deleting an account, run as the student: take them off their team (even a locked one).
-- The app then deletes the login itself, which removes the profile, messages, points and invites.
create or replace function public.leave_hackathon()
returns void language plpgsql security definer set search_path = public
as $$
declare v_team uuid; v_left int;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if public.is_admin() then raise exception 'Organizer accounts can''t be deleted here. Ask another organizer.'; end if;
  v_team := public._remove_member(auth.uid());
  if v_team is not null then
    select count(*) into v_left from public.team_members where team_id = v_team;
    -- a locked team that just lost someone is no longer a full team, so let it recruit again
    if v_left > 0 then update public.teams set locked_at = null where id = v_team and locked_at is not null; end if;
  end if;
  update public.invites set status = 'cancelled', responded_at = now()
   where (student_id = auth.uid() or sent_by = auth.uid()) and status = 'pending';
  perform public.log_admin('account_deleted', jsonb_build_object('had_team', v_team is not null, 'team', v_team));
end $$;

-- ---------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['set_team_leader(uuid)', 'lock_team()', 'touch_active()', 'leave_hackathon()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_leader_on_join()', '_leader_on_leave()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
