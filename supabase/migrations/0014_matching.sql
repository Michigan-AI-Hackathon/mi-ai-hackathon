-- =====================================================================
-- Organizer matching: settings, releasing a seat, and applying a reviewed matching plan.
-- Same pattern as 0008: every function checks public.is_admin() inside the database, enforces the
-- real team rules (team_add_problem), and writes to audit_log. Nothing here runs by itself.
-- =====================================================================

-- ---------- Settings (one row, organizers only) ----------
create table public.matching_settings (
  id                      boolean primary key default true check (id),
  target_team_size        int     not null default 4 check (target_team_size between 3 and 4),
  allow_force_school_mix  boolean not null default false,   -- may an organizer apply a plan that breaks the school-mix rule?
  track_weight            numeric not null default 3 check (track_weight between 0 and 10)  -- how much "same track" counts in suggestions
);
insert into public.matching_settings default values;
alter table public.matching_settings enable row level security;
revoke all on public.matching_settings from anon, authenticated;

create or replace function public.admin_matching_settings()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_admin();
  return (select jsonb_build_object('target_team_size', target_team_size,
                                    'allow_force_school_mix', allow_force_school_mix,
                                    'track_weight', track_weight) from public.matching_settings);
end $$;

create or replace function public.admin_set_matching_settings(p_size int, p_force boolean, p_track_weight numeric)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  if p_size is null or p_size not between 3 and 4 then raise exception 'Team size must be 3 or 4.'; end if;
  if p_track_weight is null or p_track_weight not between 0 and 10 then raise exception 'Track weight must be 0 to 10.'; end if;
  update public.matching_settings
     set target_team_size = p_size, allow_force_school_mix = coalesce(p_force, false), track_weight = p_track_weight;
  perform public.log_admin('matching_settings', jsonb_build_object('target_team_size', p_size, 'allow_force_school_mix', coalesce(p_force, false), 'track_weight', p_track_weight));
end $$;

-- ---------- Release one seat (e.g. a no-show) ----------
-- Locked teams are refused: unlock the team first so the change is deliberate.
create or replace function public.admin_release_seat(p_student uuid, p_team uuid default null, p_note text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_team uuid; v_locked timestamptz;
begin
  perform public.require_admin();
  select t.id, t.locked_at into v_team, v_locked
    from public.team_members tm join public.teams t on t.id = tm.team_id
   where tm.user_id = p_student
   for update of t;
  if v_team is null then raise exception 'That student is not on a team.'; end if;
  if p_team is not null and p_team <> v_team then raise exception 'That student is on a different team now. Reload and check again.'; end if;
  if v_locked is not null then raise exception 'This team is locked. Unlock it first.'; end if;
  perform public._remove_member(p_student);
  perform public.log_admin('release_seat', jsonb_build_object('student', p_student, 'team', v_team, 'note', left(coalesce(p_note, ''), 200)));
end $$;

-- ---------- Team-chat notices (system-style messages posted into the TEAM conversation) ----------
-- Names come from profiles: control characters removed, whitespace squeezed, cut at 40 characters.
create or replace function public._plain_name(p_user uuid)
returns text language sql stable security definer set search_path = public
as $$
  select coalesce(nullif(left(trim(regexp_replace(coalesce((select full_name from public.profiles where id = p_user), ''), '[[:cntrl:][:space:]]+', ' ', 'g')), 40), ''), 'A new teammate');
$$;

create or replace function public._join_names(p_names text[])
returns text language sql immutable
as $$
  select case coalesce(array_length(p_names, 1), 0)
    when 0 then 'your teammates'
    when 1 then p_names[1]
    else array_to_string(p_names[1:array_length(p_names, 1) - 1], ', ') || ' and ' || p_names[array_length(p_names, 1)]
  end;
$$;

-- Posts one message into a team's chat and makes sure it counts as unread for the listed people.
-- Sent as the organizer (messages need a real sender). New members were just added, so their read marker
-- is moved one second back, like admin_post_announcement does, or the message would not count as unread.
create or replace function public._team_notice(p_team uuid, p_body text, p_unread_for uuid[] default '{}')
returns void language plpgsql security definer set search_path = public
as $$
declare v_conv uuid;
begin
  select id into v_conv from public.conversations where team_id = p_team;
  if v_conv is null then return; end if;
  update public.conversation_members set last_read_at = now() - interval '1 second'
   where conversation_id = v_conv and user_id = any(coalesce(p_unread_for, '{}')) and last_read_at > now() - interval '1 second';
  insert into public.messages (conversation_id, sender_id, body, created_at)
  values (v_conv, auth.uid(), left(p_body, 1000), clock_timestamp());
end $$;

-- ---------- Apply a reviewed plan in ONE transaction ----------
-- p_plan = {
--   "force":    false,                                        -- ignore the school-mix rule (needs the setting turned on)
--   "notify":   true,                                         -- post team-chat messages for placements (default on; false posts nothing)
--   "releases": [{"student": uuid, "team": uuid}],            -- free these seats first
--   "marks":    [{"student": uuid, "team": uuid}],            -- record "did not show up", team unchanged
--   "teams":    [{"team_id": uuid|null, "name": text, "track": text|null, "students": [uuid]}]
-- }
-- Notices are written in the same transaction, so a failed plan posts nothing and a plan cannot post twice.
-- If any student breaks any rule, or anything changed since the organizer looked, NOTHING changes.
create or replace function public.admin_apply_matching(p_plan jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_set public.matching_settings; v_force boolean; e jsonb; s text; v_team uuid; v_student uuid;
  v_placed int := 0; v_released int := 0; v_marked int := 0; v_created int := 0; v_n int;
  v_problem text; v_moves jsonb := '[]'; v_locked timestamptz; v_out jsonb := '[]';
  v_notify boolean; v_why jsonb := '{}'; v_reason text; v_existing boolean; v_name text; v_mates text[]; v_new uuid[];
  v_posted int := 0;
begin
  perform public.require_admin();
  if jsonb_typeof(p_plan) <> 'object' then raise exception 'Bad plan.'; end if;
  if jsonb_array_length(coalesce(p_plan->'releases', '[]')) > 500 or jsonb_array_length(coalesce(p_plan->'marks', '[]')) > 500
     or jsonb_array_length(coalesce(p_plan->'teams', '[]')) > 300 then raise exception 'Plan is too big.'; end if;

  -- one apply at a time
  perform pg_advisory_xact_lock(hashtext('admin_apply_matching'));
  select * into v_set from public.matching_settings;
  v_force := coalesce((p_plan->>'force')::boolean, false);
  v_notify := coalesce((p_plan->>'notify')::boolean, true);
  if v_force and not v_set.allow_force_school_mix then
    raise exception 'Ignoring the school rule is turned off in matching settings.'; end if;

  -- lock every existing team the plan touches, in a fixed order, before reading sizes
  perform 1 from public.teams where id in (
      select nullif(x->>'team_id', '')::uuid from jsonb_array_elements(coalesce(p_plan->'teams', '[]')) x
      union select (x->>'team')::uuid from jsonb_array_elements(coalesce(p_plan->'releases', '[]')) x
      union select (x->>'team')::uuid from jsonb_array_elements(coalesce(p_plan->'marks', '[]')) x
    ) order by id for update;

  -- 1) releases
  for e in select * from jsonb_array_elements(coalesce(p_plan->'releases', '[]')) loop
    v_student := (e->>'student')::uuid; v_team := (e->>'team')::uuid;
    if not exists (select 1 from public.team_members where user_id = v_student and team_id = v_team) then
      raise exception 'A student you are releasing is no longer on that team. Reload and check again.'; end if;
    select locked_at into v_locked from public.teams where id = v_team;
    if v_locked is not null then raise exception 'A team in the plan is locked. Unlock it first.'; end if;
    -- why they are moving: other people from that same team were also released or marked as no-shows
    v_why := v_why || jsonb_build_object(v_student::text, case when exists (
        select 1 from (select x from jsonb_array_elements(coalesce(p_plan->'releases', '[]')) x
                       union all select x from jsonb_array_elements(coalesce(p_plan->'marks', '[]')) x) o
         where (o.x->>'team')::uuid = v_team and (o.x->>'student')::uuid <> v_student) then 'noshow' else 'incomplete' end);
    perform public._remove_member(v_student);
    v_released := v_released + 1;
    v_moves := v_moves || jsonb_build_object('release', v_student, 'team', v_team);
  end loop;

  -- 2) marks (no change to the team, just the record)
  for e in select * from jsonb_array_elements(coalesce(p_plan->'marks', '[]')) loop
    v_student := (e->>'student')::uuid; v_team := (e->>'team')::uuid;
    if not exists (select 1 from public.team_members where user_id = v_student and team_id = v_team) then
      raise exception 'A student you are marking is no longer on that team. Reload and check again.'; end if;
    perform public.log_admin('mark_no_show', jsonb_build_object('student', v_student, 'team', v_team));
    v_marked := v_marked + 1;
  end loop;

  -- 3) placements
  for e in select * from jsonb_array_elements(coalesce(p_plan->'teams', '[]')) loop
    if jsonb_array_length(coalesce(e->'students', '[]')) = 0 then continue; end if;
    v_team := nullif(e->>'team_id', '')::uuid;
    if v_team is null then
      insert into public.teams (name, track)
      values (left(coalesce(nullif(trim(e->>'name'), ''), 'New team'), 40), nullif(e->>'track', ''))
      returning id into v_team;
      v_created := v_created + 1;
      v_existing := false;
    elsif not exists (select 1 from public.teams where id = v_team and locked_at is null) then
      raise exception 'A team in the plan is locked or no longer exists.';
    else
      v_existing := true;
    end if;
    v_new := '{}';
    select count(*) into v_n from public.team_members where team_id = v_team;
    if v_n + jsonb_array_length(e->'students') > v_set.target_team_size then
      raise exception 'A team in the plan would go over % people.', v_set.target_team_size; end if;
    v_out := v_out || jsonb_build_object('team_id', v_team, 'students', e->'students');
    for s in select jsonb_array_elements_text(e->'students') loop
      v_student := s::uuid;
      if exists (select 1 from public.team_members where user_id = v_student) then
        raise exception 'A student in the plan is already on a team. Reload and check again.'; end if;
      perform public.require_ready_student(v_student);
      if not v_force then
        v_problem := public.team_add_problem(v_team, v_student);
        if v_problem is not null then raise exception '%', v_problem; end if;
      end if;
      perform public._place_member(v_student, v_team);
      v_placed := v_placed + 1;
      v_new := v_new || v_student;
      v_moves := v_moves || jsonb_build_object('place', v_student, 'team', v_team);
      -- tell the people who were already on the team (before this student, so they are not told about themselves)
      if v_notify and v_existing then
        v_reason := coalesce(v_why->>(v_student::text), 'solo');
        perform public._team_notice(v_team,
          public._plain_name(v_student) || ' joined your team. ' ||
          case v_reason when 'noshow' then 'Their teammates didn''t show up, so they were placed with you.'
                        when 'incomplete' then 'Their team was incomplete, so they were placed with you.'
                        else 'They were looking for a team, so they were placed with you.' end ||
          ' Say hi and keep going!', v_new);
        v_posted := v_posted + 1;
      end if;
    end loop;

    -- welcome the newcomers with their teammates' names (one message per newcomer, or one for a whole new team)
    if v_notify then
      if v_existing then
        foreach v_student in array v_new loop
          select coalesce(array_agg(public._plain_name(user_id) order by joined_at), '{}') into v_mates
            from public.team_members where team_id = v_team and user_id <> v_student;
          perform public._team_notice(v_team,
            'Welcome, ' || public._plain_name(v_student) || '! Your teammates are ' || public._join_names(v_mates) || '. Say hi and keep going!', v_new);
          v_posted := v_posted + 1;
        end loop;
      else
        select coalesce(array_agg(public._plain_name(user_id) order by joined_at), '{}') into v_mates
          from public.team_members where team_id = v_team;
        perform public._team_notice(v_team,
          'Welcome to the team! An organizer put you together: ' || public._join_names(v_mates) || '. Say hi and keep going!', v_new);
        v_posted := v_posted + 1;
      end if;
    end if;
  end loop;

  perform public.log_admin('apply_matching', jsonb_build_object(
    'placed', v_placed, 'released', v_released, 'marked', v_marked, 'new_teams', v_created, 'force', v_force, 'notify', v_notify, 'chat_messages', v_posted,
    'moves', case when jsonb_array_length(v_moves) > 200 then '[]'::jsonb else v_moves end));
  return jsonb_build_object('placed', v_placed, 'released', v_released, 'marked', v_marked, 'new_teams', v_created, 'chat_messages', v_posted, 'teams', v_out);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_matching_settings()', 'admin_set_matching_settings(int,boolean,numeric)',
    'admin_release_seat(uuid,uuid,text)', 'admin_apply_matching(jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

revoke all on function public._plain_name(uuid), public._join_names(text[]), public._team_notice(uuid, text, uuid[]) from public, anon, authenticated;
