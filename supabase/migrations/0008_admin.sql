-- =====================================================================
-- Organizer tools. Every organizer action is a function that
--   1. checks the caller really is an organizer (public.is_admin()) INSIDE the database,
--   2. enforces the same team rules students get (unless the organizer forces an override),
--   3. writes a row to audit_log.
-- Pages and buttons can't skip these checks, and students can't call them successfully.
-- Organizers are made with SQL only:  update public.profiles set is_admin = true where email = '...';
-- =====================================================================

alter table public.profiles add column checked_in_at timestamptz;

-- Students can never set their own check-in (added to the protected columns).
create or replace function public.protect_profile_columns()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user in ('authenticated','anon') then
    new.email := old.email;  new.is_admin := old.is_admin;
    new.paid_at := old.paid_at;  new.created_at := old.created_at;
    new.checked_in_at := old.checked_in_at;
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

-- Profile pictures: a preset, or an image in OUR avatars bucket only
-- (an arbitrary https URL would let a student make other students' browsers call any server).
alter table public.profiles drop constraint avatar_url_format;
alter table public.profiles add constraint avatar_url_format
  check (avatar_url is null or avatar_url ~ '^preset-[a-z0-9]+$'
         or avatar_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/[0-9a-f-]{36}/[A-Za-z0-9._-]+$');

-- ---------------------------------------------------------------------
-- Audit log: append-only, readable by organizers, written only by the functions below
-- ---------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor       uuid references public.profiles(id) on delete set null,
  action      text not null,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy "organizers read audit log" on public.audit_log for select to authenticated using (public.is_admin());
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = public
as $$ begin if not public.is_admin() then raise exception 'Organizers only.'; end if; end $$;

create or replace function public.log_admin(p_action text, p_details jsonb default '{}')
returns void language sql security definer set search_path = public
as $$ insert into public.audit_log (actor, action, details) values (auth.uid(), p_action, coalesce(p_details, '{}')); $$;

-- ---------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------
create or replace function public._remove_member(p_student uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_team uuid;
begin
  select team_id into v_team from public.team_members where user_id = p_student;
  if v_team is null then return null; end if;
  delete from public.team_members where user_id = p_student;
  delete from public.conversation_members cm using public.conversations c
   where cm.conversation_id = c.id and c.team_id = v_team and cm.user_id = p_student;
  if not exists (select 1 from public.team_members where team_id = v_team) then
    delete from public.teams where id = v_team;
  end if;
  return v_team;
end $$;

create or replace function public._place_member(p_student uuid, p_team uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  insert into public.team_members (team_id, user_id) values (p_team, p_student);
  perform public.add_to_team_conversation(p_team, p_student);
  update public.invites set status = 'cancelled', responded_at = now()
   where student_id = p_student and status = 'pending';
  if (select count(*) from public.team_members where team_id = p_team) >= 4 then
    update public.invites set status = 'cancelled', responded_at = now() where team_id = p_team and status = 'pending';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Organizer actions
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare r jsonb;
begin
  perform public.require_admin();
  select jsonb_build_object(
    'signed_up',     (select count(*) from public.profiles),
    'profiles_done', (select count(*) from public.profiles where onboarded_at is not null),
    'paid',          (select count(*) from public.profiles where paid_at is not null),
    'revenue_cents', (select coalesce(sum(amount_cents), 0) from public.payments where status = 'paid'),
    'teams',         (select count(*) from public.teams),
    'locked_teams',  (select count(*) from public.teams where locked_at is not null),
    'on_team',       (select count(*) from public.team_members),
    'solo_paid',     (select count(*) from public.profiles p where p.paid_at is not null and p.onboarded_at is not null
                        and not exists (select 1 from public.team_members tm where tm.user_id = p.id)),
    'checked_in',    (select count(*) from public.profiles where checked_in_at is not null),
    'team_sizes',    (select coalesce(jsonb_object_agg(sz, n), '{}') from
                        (select sz, count(*) n from (select count(*) sz from public.team_members group by team_id) x group by sz) y),
    'by_school',     (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc), '[]') from
                        (select s.name, count(*) n from public.profiles p join public.schools s on s.id = p.school_id
                          where p.onboarded_at is not null group by s.name order by n desc limit 12) z),
    'by_track',      (select coalesce(jsonb_agg(jsonb_build_object('name', t, 'n', n) order by n desc), '[]') from
                        (select t, count(*) n from (select unnest(tracks) t from public.profiles where onboarded_at is not null) u group by t) z),
    'signups_by_day',(select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]') from
                        (select created_at::date d, count(*) n from public.profiles where created_at > now() - interval '30 days' group by 1) z)
  ) into r;
  return r;
end $$;

-- Put (or move) a student on a team. Normal rules apply unless p_force; the 4-person cap never bends.
create or replace function public.admin_add_to_team(p_student uuid, p_team uuid, p_force boolean default false)
returns void language plpgsql security definer set search_path = public
as $$
declare v_old uuid; v_problem text;
begin
  perform public.require_admin();
  if not exists (select 1 from public.teams where id = p_team) then raise exception 'Team not found.'; end if;
  if not exists (select 1 from public.profiles where id = p_student and onboarded_at is not null) then
    raise exception 'Student not found or has not finished their profile.'; end if;
  select team_id into v_old from public.team_members where user_id = p_student;
  if v_old = p_team then return; end if;
  if v_old is not null then perform public._remove_member(p_student); end if;
  if p_force then
    if (select count(*) from public.team_members where team_id = p_team) >= 4 then raise exception 'This team is full (4 people max).'; end if;
  else
    v_problem := public.team_add_problem(p_team, p_student);
    if v_problem is not null then raise exception '%', v_problem; end if;
  end if;
  perform public._place_member(p_student, p_team);
  perform public.log_admin('add_to_team', jsonb_build_object('student', p_student, 'team', p_team, 'from', v_old, 'force', p_force));
end $$;

create or replace function public.admin_remove_from_team(p_student uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_team uuid;
begin
  perform public.require_admin();
  v_team := public._remove_member(p_student);
  if v_team is null then raise exception 'That student is not on a team.'; end if;
  perform public.log_admin('remove_from_team', jsonb_build_object('student', p_student, 'team', v_team));
end $$;

create or replace function public.admin_set_team_lock(p_team uuid, p_locked boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  update public.teams set locked_at = case when p_locked then coalesce(locked_at, now()) else null end where id = p_team;
  if not found then raise exception 'Team not found.'; end if;
  if p_locked then update public.invites set status = 'cancelled', responded_at = now() where team_id = p_team and status = 'pending'; end if;
  perform public.log_admin(case when p_locked then 'lock_team' else 'unlock_team' end, jsonb_build_object('team', p_team));
end $$;

create or replace function public.admin_dissolve_team(p_team uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  delete from public.teams where id = p_team;
  if not found then raise exception 'Team not found.'; end if;
  perform public.log_admin('dissolve_team', jsonb_build_object('team', p_team));
end $$;

-- Mark someone paid without a Stripe charge (cash, scholarship, fixing a failed webhook).
create or replace function public.admin_comp_student(p_student uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  update public.profiles set paid_at = coalesce(paid_at, now()) where id = p_student;
  if not found then raise exception 'Student not found.'; end if;
  insert into public.payments (user_id, stripe_session_id, amount_cents) values (p_student, 'comp-' || gen_random_uuid(), 0);
  perform public.log_admin('comp_student', jsonb_build_object('student', p_student, 'note', left(coalesce(p_note, ''), 200)));
end $$;

create or replace function public.admin_set_checked_in(p_student uuid, p_in boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  update public.profiles set checked_in_at = case when p_in then coalesce(checked_in_at, now()) else null end where id = p_student;
  if not found then raise exception 'Student not found.'; end if;
  perform public.log_admin(case when p_in then 'check_in' else 'check_out' end, jsonb_build_object('student', p_student));
end $$;

-- Apply an auto-fill plan in ONE transaction: if any student breaks any rule, nothing changes.
-- plan: [{"team_id": uuid|null, "name": text, "track": text|null, "students": [uuid, ...]}, ...]
create or replace function public.admin_apply_plan(p_plan jsonb)
returns int language plpgsql security definer set search_path = public
as $$
declare e jsonb; s text; v_team uuid; v_n int := 0; v_problem text;
begin
  perform public.require_admin();
  if jsonb_typeof(p_plan) <> 'array' then raise exception 'Bad plan.'; end if;
  for e in select * from jsonb_array_elements(p_plan) loop
    v_team := nullif(e->>'team_id', '')::uuid;
    if v_team is null then
      insert into public.teams (name, track) values (left(coalesce(nullif(trim(e->>'name'), ''), 'New team'), 40), nullif(e->>'track', ''))
      returning id into v_team;
    elsif not exists (select 1 from public.teams where id = v_team and locked_at is null) then
      raise exception 'A team in the plan is locked or no longer exists.';
    end if;
    for s in select jsonb_array_elements_text(e->'students') loop
      if exists (select 1 from public.team_members where user_id = s::uuid) then raise exception 'A student in the plan already joined a team.'; end if;
      perform public.require_ready_student(s::uuid);
      v_problem := public.team_add_problem(v_team, s::uuid);
      if v_problem is not null then raise exception '%', v_problem; end if;
      perform public._place_member(s::uuid, v_team);
      v_n := v_n + 1;
    end loop;
  end loop;
  perform public.log_admin('auto_fill', jsonb_build_object('students_placed', v_n, 'groups', jsonb_array_length(p_plan)));
  return v_n;
end $$;

-- Lets the app record things the database can't see itself (e.g. a broadcast email was sent).
create or replace function public.admin_log_event(p_action text, p_details jsonb default '{}')
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  perform public.log_admin(left(p_action, 60), p_details);
end $$;

-- Nobody but signed-in users can even try these; non-organizers get "Organizers only."
do $$
declare f text;
begin
  foreach f in array array[
    'require_admin()', 'admin_stats()', 'admin_add_to_team(uuid,uuid,boolean)', 'admin_remove_from_team(uuid)',
    'admin_set_team_lock(uuid,boolean)', 'admin_dissolve_team(uuid)', 'admin_comp_student(uuid,text)',
    'admin_set_checked_in(uuid,boolean)', 'admin_apply_plan(jsonb)', 'admin_log_event(text,jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- internal helpers: only other database functions may call them
  foreach f in array array['log_admin(text,jsonb)', '_remove_member(uuid)', '_place_member(uuid,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
