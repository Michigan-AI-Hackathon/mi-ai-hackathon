-- =====================================================================
-- 1. Workshop points: organizers make QR codes worth points, students scan them at the venue.
-- 2. Prizes that points can be spent on (organizers record redemptions).
-- 3. Help requests from the floating "?" button.
-- 4. joinable_teams(): which teams the signed-in student could actually join (used to sort /teams).
-- =====================================================================

-- ---------- Points ----------
-- Activities. NOT readable by students (RLS on, no policy): the token is the secret printed in the QR code.
create table public.point_activities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  points     int  not null check (points between 1 and 1000),
  token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.point_activities enable row level security;
revoke all on public.point_activities from anon, authenticated;

-- Points earned. One row per person per activity (unique), so scanning twice does nothing.
create table public.point_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid references public.point_activities(id) on delete set null,
  label       text not null,
  points      int  not null check (points > 0),
  created_at  timestamptz not null default now()
);
create unique index point_ledger_once on public.point_ledger (user_id, activity_id) where activity_id is not null;
create index point_ledger_user on public.point_ledger (user_id);
alter table public.point_ledger enable row level security;
revoke all on public.point_ledger from anon, authenticated;
grant select on public.point_ledger to authenticated;
create policy "read own points" on public.point_ledger for select to authenticated using (user_id = auth.uid());
create policy "organizers read points" on public.point_ledger for select to authenticated using (public.is_admin());

create table public.prizes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  cost       int  not null check (cost between 1 and 100000),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.prizes enable row level security;
revoke all on public.prizes from anon, authenticated;
grant select on public.prizes to authenticated;
create policy "everyone reads active prizes" on public.prizes for select to authenticated using (active or public.is_admin());

-- Points spent. Written only by organizers through admin_redeem_prize.
create table public.prize_redemptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  prize_id   uuid references public.prizes(id) on delete set null,
  label      text not null,
  points     int  not null check (points > 0),
  note       text,
  by_admin   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index prize_redemptions_user on public.prize_redemptions (user_id);
alter table public.prize_redemptions enable row level security;
revoke all on public.prize_redemptions from anon, authenticated;
grant select on public.prize_redemptions to authenticated;
create policy "read own redemptions" on public.prize_redemptions for select to authenticated using (user_id = auth.uid());
create policy "organizers read redemptions" on public.prize_redemptions for select to authenticated using (public.is_admin());

create or replace function public._points_balance(p_user uuid)
returns int language sql stable security definer set search_path = public
as $$
  select coalesce((select sum(points) from public.point_ledger where user_id = p_user), 0)::int
       - coalesce((select sum(points) from public.prize_redemptions where user_id = p_user), 0)::int;
$$;
revoke all on function public._points_balance(uuid) from public, anon, authenticated;

create or replace function public.my_points()
returns int language sql stable security definer set search_path = public
as $$ select public._points_balance(auth.uid()); $$;

-- A student scans a workshop QR code. Needs: signed in, finished profile, checked in (which already required paying).
-- Scanning the same code again is harmless: returns awarded = false.
create or replace function public.scan_points(p_token text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare p public.profiles; a public.point_activities; v_new uuid;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then raise exception 'Sign in first.'; end if;
  select * into a from public.point_activities where token = p_token;
  if a.id is null then raise exception 'That QR code is not valid. Ask an organizer for help.'; end if;
  if not a.active then raise exception 'This activity is closed.'; end if;
  if p.onboarded_at is null then raise exception 'Finish your profile first.'; end if;
  if (public.settings()).require_payment and p.paid_at is null then
    raise exception 'You have not paid the registration fee yet. Ask an organizer for help.'; end if;
  if p.checked_in_at is null then raise exception 'Check in at the venue first, then scan again.'; end if;
  insert into public.point_ledger (user_id, activity_id, label, points)
  values (p.id, a.id, a.name, a.points)
  on conflict (user_id, activity_id) where activity_id is not null do nothing
  returning id into v_new;
  return jsonb_build_object('awarded', v_new is not null, 'name', a.name, 'points', a.points, 'balance', public._points_balance(p.id));
end $$;

-- ---------- Organizer functions ----------
create or replace function public.admin_create_activity(p_name text, p_points int)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  insert into public.point_activities (name, points) values (left(trim(p_name), 80), p_points);
  perform public.log_admin('points_activity_created', jsonb_build_object('name', left(trim(p_name), 80), 'points', p_points));
end $$;

create or replace function public.admin_set_activity_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  update public.point_activities set active = p_active where id = p_id;
  perform public.log_admin(case when p_active then 'points_activity_on' else 'points_activity_off' end, jsonb_build_object('id', p_id));
end $$;

create or replace function public.admin_points_activities()
returns table (id uuid, name text, points int, token text, active boolean, scans int)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_admin();
  return query
    select a.id, a.name, a.points, a.token, a.active,
           (select count(*)::int from public.point_ledger l where l.activity_id = a.id)
    from public.point_activities a order by a.created_at desc;
end $$;

create or replace function public.admin_points_leaderboard(p_limit int default 100)
returns table (user_id uuid, full_name text, email text, earned int, spent int, balance int)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_admin();
  return query
    select p.id, p.full_name, p.email::text,
           coalesce(e.n, 0)::int, coalesce(s.n, 0)::int, (coalesce(e.n, 0) - coalesce(s.n, 0))::int
    from public.profiles p
    left join (select l.user_id, sum(l.points) n from public.point_ledger l group by 1) e on e.user_id = p.id
    left join (select r.user_id, sum(r.points) n from public.prize_redemptions r group by 1) s on s.user_id = p.id
    where e.n is not null
    order by 6 desc, 2
    limit least(greatest(p_limit, 1), 500);
end $$;

create or replace function public.admin_save_prize(p_id uuid, p_name text, p_cost int, p_active boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  if p_id is null then
    insert into public.prizes (name, cost, active) values (left(trim(p_name), 80), p_cost, coalesce(p_active, true));
  else
    update public.prizes set name = left(trim(p_name), 80), cost = p_cost, active = coalesce(p_active, active) where id = p_id;
  end if;
  perform public.log_admin('prize_saved', jsonb_build_object('name', left(trim(p_name), 80), 'cost', p_cost));
end $$;

create or replace function public.admin_redeem_prize(p_user uuid, p_prize uuid, p_note text default null)
returns int language plpgsql security definer set search_path = public
as $$
declare z public.prizes; v_bal int;
begin
  perform public.require_admin();
  select * into z from public.prizes where id = p_prize;
  if z.id is null then raise exception 'Pick a prize.'; end if;
  -- serialize redemptions per person so two clicks cannot spend the same points twice
  perform 1 from public.profiles where id = p_user for update;
  if not found then raise exception 'Student not found.'; end if;
  v_bal := public._points_balance(p_user);
  if v_bal < z.cost then raise exception 'Not enough points: they have %, the prize costs %.', v_bal, z.cost; end if;
  insert into public.prize_redemptions (user_id, prize_id, label, points, note, by_admin)
  values (p_user, z.id, z.name, z.cost, left(trim(coalesce(p_note, '')), 200), auth.uid());
  perform public.log_admin('prize_redeemed', jsonb_build_object('student', p_user, 'prize', z.name, 'cost', z.cost));
  return v_bal - z.cost;
end $$;

create or replace function public.admin_recent_redemptions(p_limit int default 30)
returns table (id uuid, full_name text, label text, points int, note text, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_admin();
  return query
    select r.id, p.full_name, r.label, r.points, r.note, r.created_at
    from public.prize_redemptions r join public.profiles p on p.id = r.user_id
    order by r.created_at desc limit least(greatest(p_limit, 1), 200);
end $$;

-- ---------- Help requests ----------
create table public.help_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  topic      text,
  message    text not null check (char_length(message) between 3 and 2000),
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index help_requests_user_time on public.help_requests (user_id, created_at desc);
alter table public.help_requests enable row level security;
revoke all on public.help_requests from anon, authenticated;
grant select on public.help_requests to authenticated;
create policy "organizers read help requests" on public.help_requests for select to authenticated using (public.is_admin());

-- Stores the request (so nothing is lost if the email fails). Light rate limit: 1 per 20 seconds, 8 per hour.
create or replace function public.submit_help_request(p_topic text, p_message text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_msg text := trim(coalesce(p_message, ''));
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if char_length(v_msg) < 3 then raise exception 'Write a short message.'; end if;
  if exists (select 1 from public.help_requests where user_id = auth.uid() and created_at > now() - interval '20 seconds')
     or (select count(*) from public.help_requests where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 8 then
    raise exception 'You just sent a request. Please wait a bit before sending another.'; end if;
  insert into public.help_requests (user_id, topic, message)
  values (auth.uid(), nullif(left(trim(coalesce(p_topic, '')), 60), ''), left(v_msg, 2000))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.mark_help_emailed(p_id uuid)
returns void language sql security definer set search_path = public
as $$ update public.help_requests set emailed_at = now() where id = p_id and user_id = auth.uid(); $$;

-- ---------- Teams the signed-in student can join ----------
-- Open, not locked, not full, and passing the same school rules request_to_join enforces.
create or replace function public.joinable_teams()
returns setof uuid language sql stable security definer set search_path = public
as $$
  select t.id from public.teams t
  where t.locked_at is null
    and public.my_team_id() is null
    and public.team_add_problem(t.id, auth.uid()) is null;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'my_points()', 'scan_points(text)', 'admin_create_activity(text,int)', 'admin_set_activity_active(uuid,boolean)',
    'admin_points_activities()', 'admin_points_leaderboard(int)', 'admin_save_prize(uuid,text,int,boolean)',
    'admin_redeem_prize(uuid,uuid,text)', 'admin_recent_redemptions(int)', 'submit_help_request(text,text)',
    'mark_help_emailed(uuid)', 'joinable_teams()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
