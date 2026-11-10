-- =====================================================================
-- Judging. Judging happens in person; the app assigns judges to teams and collects scores.
-- Same pattern as 0008/0014: tables are closed to everyone (RLS on, no grants); every read and write goes
-- through a security-definer function that checks, INSIDE the database, that the caller is an organizer
-- (public.is_admin()) or a judge assigned to that team. Judges only ever see their own scores.
-- Students have no path to any of this.
--
-- A judge is an email an organizer adds. They sign in with that email (a non-Michigan email is allowed
-- only if it is on the judges list), and are matched to their judges row by their verified profile email.
-- =====================================================================

-- ---------- Team numbers (organizer-assigned, unique, shown in admin and judge views) ----------
alter table public.teams add column team_number int check (team_number between 1 and 9999);
create unique index teams_team_number_key on public.teams (team_number) where team_number is not null;

-- ---------- Tables ----------
create table public.judges (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name        text check (name is null or char_length(name) <= 80),
  org         text check (org is null or char_length(org) <= 80),   -- e.g. the sponsor company
  created_at  timestamptz not null default now()
);
create unique index judges_email_key on public.judges (email);

create table public.judge_tracks (          -- a judge sees every team on these tracks
  judge_id uuid not null references public.judges(id) on delete cascade,
  track    text not null,
  primary key (judge_id, track)
);
create table public.judge_teams (           -- ...plus these specific teams
  judge_id uuid not null references public.judges(id) on delete cascade,
  team_id  uuid not null references public.teams(id)  on delete cascade,
  primary key (judge_id, team_id)
);

create table public.scoring_criteria (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  description text check (description is null or char_length(description) <= 200),
  max_score   int  not null check (max_score between 1 and 100),
  position    int  not null default 0,
  active      boolean not null default true   -- criteria that already have scores are hidden, not deleted
);

create table public.judge_scores (
  judge_id     uuid not null references public.judges(id) on delete cascade,
  team_id      uuid not null references public.teams(id) on delete cascade,
  criterion_id uuid not null references public.scoring_criteria(id) on delete cascade,
  score        int  not null check (score >= 0),
  updated_at   timestamptz not null default now(),
  primary key (judge_id, team_id, criterion_id)
);
create table public.judge_reviews (
  judge_id   uuid not null references public.judges(id) on delete cascade,
  team_id    uuid not null references public.teams(id)  on delete cascade,
  comment    text check (comment is null or char_length(comment) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (judge_id, team_id)
);

do $$
declare t text;
begin
  foreach t in array array['judges','judge_tracks','judge_teams','scoring_criteria','judge_scores','judge_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------- Helpers ----------
create or replace function public.my_judge_id()
returns uuid language sql stable security definer set search_path = public
as $$ select j.id from public.judges j join public.profiles p on lower(p.email) = j.email where p.id = auth.uid() limit 1; $$;

create or replace function public.is_judge()
returns boolean language sql stable security definer set search_path = public
as $$ select public.my_judge_id() is not null; $$;

create or replace function public._judge_can_see(p_judge uuid, p_team uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.judge_teams where judge_id = p_judge and team_id = p_team)
      or exists (select 1 from public.judge_tracks jt join public.teams t on t.track = jt.track
                  where jt.judge_id = p_judge and t.id = p_team);
$$;

-- Sign-in page asks this before sending a code to a non-Michigan address. Only says yes/no.
create or replace function public.judge_invited(p_email text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.judges where email = lower(trim(p_email))); $$;

-- Let invited judges create an account even without a Michigan school email.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_school int; v_count int;
begin
  if not public.is_michigan_email(new.email)
     and not exists (select 1 from public.judges where email = lower(new.email)) then
    raise exception 'Only Michigan college and university emails can sign up.';
  end if;
  select count(*), min(id) into v_count, v_school from public.schools_for_email(new.email);
  insert into public.profiles (id, email, school_id)
  values (new.id, new.email, case when v_count = 1 then v_school end);
  return new;
end $$;

-- ---------- Organizer: judges ----------
create or replace function public.admin_add_judge(p_email text, p_name text default null, p_org text default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_id uuid;
begin
  perform public.require_admin();
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a full email address.'; end if;
  if exists (select 1 from public.judges where email = v_email) then raise exception 'That judge is already added.'; end if;
  insert into public.judges (email, name, org)
  values (v_email, nullif(left(trim(coalesce(p_name, '')), 80), ''), nullif(left(trim(coalesce(p_org, '')), 80), ''))
  returning id into v_id;
  perform public.log_admin('add_judge', jsonb_build_object('judge', v_id, 'email', v_email));
  return v_id;
end $$;

create or replace function public.admin_remove_judge(p_judge uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  delete from public.judges where id = p_judge;
  perform public.log_admin('remove_judge', jsonb_build_object('judge', p_judge));
end $$;

-- Replace what one judge can see: whole tracks and/or specific teams.
create or replace function public.admin_set_judge_assignments(p_judge uuid, p_tracks text[], p_teams uuid[])
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  if not exists (select 1 from public.judges where id = p_judge) then raise exception 'Judge not found.'; end if;
  if coalesce(array_length(p_tracks, 1), 0) > 20 or coalesce(array_length(p_teams, 1), 0) > 500 then raise exception 'Too many assignments.'; end if;
  delete from public.judge_tracks where judge_id = p_judge;
  delete from public.judge_teams  where judge_id = p_judge;
  insert into public.judge_tracks (judge_id, track)
    select p_judge, t from (select distinct left(trim(x), 60) t from unnest(coalesce(p_tracks, '{}')) x) s where t <> '';
  insert into public.judge_teams (judge_id, team_id)
    select p_judge, t.id from public.teams t where t.id = any(coalesce(p_teams, '{}'));
  perform public.log_admin('set_judge_assignments', jsonb_build_object('judge', p_judge, 'tracks', coalesce(p_tracks, '{}'), 'teams', coalesce(array_length(p_teams, 1), 0)));
end $$;

-- ---------- Organizer: team numbers ----------
create or replace function public.admin_set_team_number(p_team uuid, p_number int)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  if p_number is not null and p_number not between 1 and 9999 then raise exception 'Team numbers go from 1 to 9999.'; end if;
  if p_number is not null and exists (select 1 from public.teams where team_number = p_number and id <> p_team) then
    raise exception 'Number % is already used by another team.', p_number; end if;
  update public.teams set team_number = p_number where id = p_team;
  if not found then raise exception 'Team not found.'; end if;
  perform public.log_admin('set_team_number', jsonb_build_object('team', p_team, 'number', p_number));
end $$;

-- Auto-number: only teams without a number (continuing after the highest), or everyone from 1 (grouped by track).
create or replace function public.admin_auto_number_teams(p_all boolean default false)
returns int language plpgsql security definer set search_path = public
as $$
declare v_start int; v_n int;
begin
  perform public.require_admin();
  perform pg_advisory_xact_lock(hashtext('admin_auto_number_teams'));
  if p_all then update public.teams set team_number = null; end if;
  select coalesce(max(team_number), 0) into v_start from public.teams;
  with ordered as (
    select id, v_start + row_number() over (order by coalesce(track, 'zzz'), created_at, id) n
      from public.teams where team_number is null)
  update public.teams t set team_number = o.n from ordered o where t.id = o.id;
  get diagnostics v_n = row_count;
  perform public.log_admin('auto_number_teams', jsonb_build_object('numbered', v_n, 'renumbered_all', p_all));
  return v_n;
end $$;

-- ---------- Organizer: rubric ----------
-- p_items = [{"id": uuid|null, "name": text, "description": text, "max_score": int}], in display order.
-- Criteria left out are deleted, or hidden if judges already scored them (so scores are never lost silently).
create or replace function public.admin_save_criteria(p_items jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare e jsonb; i int := 0; v_id uuid; v_keep uuid[] := '{}'; v_max int; v_name text;
begin
  perform public.require_admin();
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 20 then raise exception 'Use up to 20 criteria.'; end if;
  for e in select * from jsonb_array_elements(p_items) loop
    v_name := left(trim(coalesce(e->>'name', '')), 60);
    if v_name = '' then raise exception 'Every criterion needs a name.'; end if;
    v_max := (e->>'max_score')::int;
    if v_max is null or v_max not between 1 and 100 then raise exception '"%" needs a top score from 1 to 100.', v_name; end if;
    v_id := nullif(e->>'id', '')::uuid;
    if v_id is not null and exists (select 1 from public.scoring_criteria where id = v_id) then
      update public.scoring_criteria
         set name = v_name, description = nullif(left(trim(coalesce(e->>'description', '')), 200), ''),
             max_score = v_max, position = i, active = true where id = v_id;
      if exists (select 1 from public.judge_scores where criterion_id = v_id and score > v_max) then
        raise exception 'Judges already gave "%" a score above %. Raise the top score or clear those scores first.', v_name, v_max; end if;
    else
      insert into public.scoring_criteria (name, description, max_score, position)
      values (v_name, nullif(left(trim(coalesce(e->>'description', '')), 200), ''), v_max, i) returning id into v_id;
    end if;
    v_keep := v_keep || v_id;
    i := i + 1;
  end loop;
  delete from public.scoring_criteria c where c.id <> all(v_keep)
     and not exists (select 1 from public.judge_scores s where s.criterion_id = c.id);
  update public.scoring_criteria set active = false where id <> all(v_keep);
  perform public.log_admin('save_criteria', jsonb_build_object('count', i));
end $$;

-- ---------- Organizer: everything in one read ----------
create or replace function public.admin_judging_data()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'criteria', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'description', description, 'max_score', max_score, 'active', active) order by position, name), '[]')
                   from public.scoring_criteria),
    'judges',   (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', j.id, 'email', j.email, 'name', j.name, 'org', j.org,
                    'signed_in', exists (select 1 from public.profiles p where lower(p.email) = j.email),
                    'tracks', (select coalesce(jsonb_agg(track order by track), '[]') from public.judge_tracks where judge_id = j.id),
                    'teams',  (select coalesce(jsonb_agg(team_id), '[]') from public.judge_teams where judge_id = j.id)
                  ) order by j.created_at), '[]') from public.judges j),
    'teams',    (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', t.id, 'number', t.team_number, 'name', t.name, 'track', t.track,
                    'members', (select count(*) from public.team_members tm where tm.team_id = t.id)
                  ) order by t.team_number nulls last, t.name), '[]') from public.teams t),
    'scores',   (select coalesce(jsonb_agg(jsonb_build_object('judge', judge_id, 'team', team_id, 'criterion', criterion_id, 'score', score)), '[]') from public.judge_scores),
    'reviews',  (select coalesce(jsonb_agg(jsonb_build_object('judge', judge_id, 'team', team_id, 'comment', comment, 'updated_at', updated_at)), '[]') from public.judge_reviews)
  );
end $$;

-- ---------- Judge: only their own assigned teams and their own scores ----------
create or replace function public.judge_me()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_id uuid := public.my_judge_id();
begin
  if v_id is null then return null; end if;
  return (select jsonb_build_object('id', id, 'name', name, 'org', org, 'email', email) from public.judges where id = v_id);
end $$;

create or replace function public.judge_overview()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_id uuid := public.my_judge_id();
begin
  if v_id is null then raise exception 'Judges only.'; end if;
  return jsonb_build_object(
    'criteria', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'description', description, 'max_score', max_score) order by position, name), '[]')
                   from public.scoring_criteria where active),
    'teams', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'number', t.team_number, 'name', t.name, 'track', t.track,
        'members', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(p.full_name, 'Student'), 'school', s.name) order by tm.joined_at), '[]')
                      from public.team_members tm join public.profiles p on p.id = tm.user_id left join public.schools s on s.id = p.school_id
                     where tm.team_id = t.id),
        'scores', (select coalesce(jsonb_object_agg(criterion_id, score), '{}') from public.judge_scores where judge_id = v_id and team_id = t.id),
        'comment', (select comment from public.judge_reviews where judge_id = v_id and team_id = t.id)
      ) order by t.team_number nulls last, t.name), '[]')
      from public.teams t where public._judge_can_see(v_id, t.id))
  );
end $$;

-- p_scores = {"<criterion id>": whole number}. Only criteria that are active and within 0..max are accepted.
create or replace function public.judge_save_review(p_team uuid, p_scores jsonb, p_comment text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_id uuid := public.my_judge_id(); k text; v numeric; c public.scoring_criteria;
begin
  if v_id is null then raise exception 'Judges only.'; end if;
  if not public._judge_can_see(v_id, p_team) then raise exception 'That team is not assigned to you.'; end if;
  if jsonb_typeof(coalesce(p_scores, '{}')) <> 'object' then raise exception 'Bad scores.'; end if;
  for k, v in select key, nullif(value #>> '{}', '')::numeric from jsonb_each(coalesce(p_scores, '{}')) loop
    continue when v is null;
    select * into c from public.scoring_criteria where id = k::uuid and active;
    if c.id is null then raise exception 'Unknown criterion.'; end if;
    if v <> trunc(v) or v < 0 or v > c.max_score then raise exception '"%" must be a whole number from 0 to %.', c.name, c.max_score; end if;
    insert into public.judge_scores (judge_id, team_id, criterion_id, score) values (v_id, p_team, c.id, v::int)
    on conflict (judge_id, team_id, criterion_id) do update set score = excluded.score, updated_at = now();
  end loop;
  insert into public.judge_reviews (judge_id, team_id, comment)
  values (v_id, p_team, nullif(left(trim(coalesce(p_comment, '')), 2000), ''))
  on conflict (judge_id, team_id) do update set comment = excluded.comment, updated_at = now();
end $$;

-- ---------- Grants ----------
do $$
declare f text;
begin
  foreach f in array array[
    'admin_add_judge(text,text,text)', 'admin_remove_judge(uuid)', 'admin_set_judge_assignments(uuid,text[],uuid[])',
    'admin_set_team_number(uuid,int)', 'admin_auto_number_teams(boolean)', 'admin_save_criteria(jsonb)', 'admin_judging_data()',
    'judge_me()', 'judge_overview()', 'judge_save_review(uuid,jsonb,text)', 'is_judge()', 'my_judge_id()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- the sign-in page asks this before the user has an account
revoke all on function public.judge_invited(text) from public;
grant execute on function public.judge_invited(text) to anon, authenticated;
revoke all on function public._judge_can_see(uuid, uuid) from public, anon, authenticated;
