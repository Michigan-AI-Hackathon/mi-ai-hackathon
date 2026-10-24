-- =====================================================================
-- Michigan AI Hackathon: team-matching platform
-- Run in the Supabase SQL editor (or `supabase db push`), in file order.
-- Every team rule lives in this file, so a bug in a page can't break it.
-- =====================================================================

create extension if not exists citext;

-- ---------------------------------------------------------------------
-- Settings (one row). Change these in the Table Editor, no deploy needed.
-- ---------------------------------------------------------------------
create table public.app_settings (
  id                   boolean primary key default true check (id),
  invite_hours         int         not null default 48,   -- invites expire after this many hours
  max_pending_invites  int         not null default 5,    -- open invites a team can have at once
  lock_deadline        timestamptz,                       -- teams locked by this date get a guaranteed spot
  require_payment      boolean     not null default true  -- must pay the registration fee before teaming up
);
insert into public.app_settings default values;

-- ---------------------------------------------------------------------
-- Schools and their email endings (seeded in 0002_schools.sql)
-- ---------------------------------------------------------------------
create table public.schools (
  id          serial primary key,
  name        text not null unique,
  kind        text not null check (kind in ('public','community','tribal','private','graduate')),
  rule_group  text            -- same group = counted as one school for team rules (null = its own)
);

create table public.school_domains (
  domain     citext not null,
  school_id  int    not null references public.schools(id) on delete cascade,
  primary key (domain, school_id)
);

-- Schools an email address belongs to. Matches the exact ending or any
-- subdomain of it (mail.gvsu.edu -> gvsu.edu), never look-alikes (fakeumich.edu).
create or replace function public.schools_for_email(p_email text)
returns setof public.schools
language sql stable security definer set search_path = public
as $$
  select s.*
  from public.schools s
  join public.school_domains d on d.school_id = s.id
  where lower(split_part(p_email, '@', 2)) = lower(d.domain::text)
     or lower(split_part(p_email, '@', 2)) like '%.' || lower(d.domain::text)
  order by s.name;
$$;

create or replace function public.is_michigan_email(p_email text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.schools_for_email(p_email)); $$;

-- Group key used by the team rules
create or replace function public.school_group(p_school_id int)
returns text language sql stable set search_path = public
as $$ select coalesce(rule_group, 'school-' || id) from public.schools where id = p_school_id; $$;

-- ---------------------------------------------------------------------
-- Profiles (one per account)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             citext not null unique,
  full_name         text,
  school_id         int references public.schools(id),
  year              text,              -- PRIVATE: never shown to other students
  study_area        text,              -- what they study (major / program)
  skills            text[] not null default '{}',
  interests         text[] not null default '{}',
  tracks            text[] not null default '{}',
  bio               text,              -- "what I'm looking for"
  looking_for_team  boolean not null default true,
  linkedin_url      text,
  onboarded_at      timestamptz,
  paid_at           timestamptz,
  is_admin          boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint bio_len check (char_length(coalesce(bio,'')) <= 500)
);

-- Block sign-ups from non-Michigan emails at the database level, and
-- create the profile row. Runs inside Supabase's sign-up transaction.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_school int; v_count int;
begin
  if not public.is_michigan_email(new.email) then
    raise exception 'Only Michigan college and university emails can sign up.';
  end if;
  select count(*), min(id) into v_count, v_school from public.schools_for_email(new.email);
  insert into public.profiles (id, email, school_id)
  values (new.id, new.email, case when v_count = 1 then v_school end);  -- multi-campus: chosen at onboarding
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Students can't change admin/paid/email/onboarded flags themselves.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user in ('authenticated','anon') then
    new.email := old.email;  new.is_admin := old.is_admin;
    new.paid_at := old.paid_at;  new.created_at := old.created_at;
    -- school must be one their email actually belongs to
    if new.school_id is distinct from old.school_id and new.school_id is not null
       and not exists (select 1 from public.schools_for_email(old.email) s where s.id = new.school_id) then
      raise exception 'That school does not match your email.';
    end if;
    -- school can't change once they're on a team (would break team rules)
    if new.school_id is distinct from old.school_id
       and exists (select 1 from public.team_members where user_id = old.id) then
      raise exception 'Leave your team before changing schools.';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Teams, members, invites
-- ---------------------------------------------------------------------
create table public.teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 2 and 40),
  track        text,
  needs        text,                  -- "skills we still need"
  created_by   uuid references public.profiles(id) on delete set null,
  locked_at    timestamptz,
  created_at   timestamptz not null default now()
);

create table public.team_members (
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null unique references public.profiles(id) on delete cascade,  -- one team per student
  joined_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);

create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

create table public.invites (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,  -- the non-member
  kind          text not null check (kind in ('invite','request')),  -- invite: team -> student, request: student -> team
  sent_by       uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending','accepted','declined','expired','cancelled')),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  responded_at  timestamptz
);
create unique index one_pending_invite_per_pair
  on public.invites (team_id, student_id) where status = 'pending';

-- ---------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('team','direct')),
  team_id     uuid unique references public.teams(id) on delete cascade,
  direct_key  text unique,          -- "<smaller uuid>:<larger uuid>" for 1:1 chats
  created_at  timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  last_read_at     timestamptz not null default now(),
  last_emailed_at  timestamptz,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid not null references public.profiles(id) on delete cascade,
  body             text not null check (char_length(body) between 1 and 2000),
  created_at       timestamptz not null default now()
);
create index messages_conv_time on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------
-- Payments (written only by the Stripe webhook, using the service key)
-- ---------------------------------------------------------------------
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  stripe_session_id  text unique not null,
  payment_intent     text,
  amount_cents       int not null,
  status             text not null default 'paid' check (status in ('paid','refunded')),
  created_at         timestamptz not null default now(),
  refunded_at        timestamptz
);

-- =====================================================================
-- Helpers
-- =====================================================================
create or replace function public.settings()
returns public.app_settings language sql stable set search_path = public
as $$ select * from public.app_settings limit 1; $$;

create or replace function public.my_team_id()
returns uuid language sql stable security definer set search_path = public
as $$ select team_id from public.team_members where user_id = auth.uid(); $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false); $$;

-- Can this student be added to this team without breaking the school-mix rules?
--   * at most 4 members
--   * at most 2 from the same school
--   * at most ONE school with 2 members (so a full team of 4 always has 3+ schools)
-- Returns null if OK, otherwise the reason.
create or replace function public.team_add_problem(p_team uuid, p_student uuid)
returns text language plpgsql stable security definer set search_path = public
as $$
declare v_size int; v_group text; v_same int; v_doubles int;
begin
  select count(*) into v_size from public.team_members where team_id = p_team;
  if v_size >= 4 then return 'This team is full (4 people max).'; end if;

  select public.school_group(school_id) into v_group from public.profiles where id = p_student;
  if v_group is null then return 'This student has not picked a school yet.'; end if;

  select count(*) into v_same
  from public.team_members tm join public.profiles p on p.id = tm.user_id
  where tm.team_id = p_team and public.school_group(p.school_id) = v_group;
  if v_same >= 2 then return 'A team can have at most 2 people from the same school.'; end if;

  if v_same = 1 then
    select count(*) into v_doubles from (
      select public.school_group(p.school_id)
      from public.team_members tm join public.profiles p on p.id = tm.user_id
      where tm.team_id = p_team
      group by 1 having count(*) >= 2
    ) d;
    if v_doubles >= 1 then
      return 'This team already has 2 people from one school, so everyone else must be from a different school.';
    end if;
  end if;
  return null;
end $$;

-- Is the team valid to lock in?
--   4 people: 3+ schools (guaranteed by the add rules)
--   3 people: all from different schools
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

  if v_size < 3 then return 'You need at least 3 people to lock in.'; end if;
  if v_size = 3 and v_groups < 3 then
    return 'A team of 3 must have all 3 people from different schools. Add a 4th person or swap someone.';
  end if;
  if v_size = 4 and v_groups < 3 then return 'A team of 4 needs people from at least 3 schools.'; end if;
  if (public.settings()).require_payment and v_unpaid > 0 then
    return 'Everyone on the team has to pay the registration fee before you can lock in.';
  end if;
  return null;
end $$;

create or replace function public.require_ready_student(p_user uuid)
returns void language plpgsql stable security definer set search_path = public
as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = p_user;
  if p.onboarded_at is null then raise exception 'Finish your profile first.'; end if;
  if (public.settings()).require_payment and p.paid_at is null then
    raise exception 'Pay the registration fee first.';
  end if;
end $$;

create or replace function public.add_to_team_conversation(p_team uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_conv uuid;
begin
  select id into v_conv from public.conversations where team_id = p_team;
  if v_conv is null then
    insert into public.conversations (kind, team_id) values ('team', p_team) returning id into v_conv;
  end if;
  insert into public.conversation_members (conversation_id, user_id)
  values (v_conv, p_user) on conflict do nothing;
end $$;

-- Mark invites past their expiry as expired (also run by the cron job)
create or replace function public.expire_old_invites()
returns int language sql security definer set search_path = public
as $$
  with x as (
    update public.invites set status = 'expired'
    where status = 'pending' and expires_at < now() returning 1
  ) select count(*)::int from x;
$$;

-- =====================================================================
-- Actions students call (RPCs). All checks happen here.
-- =====================================================================
create or replace function public.create_team(p_name text, p_track text default null, p_needs text default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_team uuid;
begin
  perform public.require_ready_student(auth.uid());
  if public.my_team_id() is not null then raise exception 'You are already on a team.'; end if;
  insert into public.teams (name, track, needs, created_by)
  values (trim(p_name), p_track, p_needs, auth.uid()) returning id into v_team;
  insert into public.team_members (team_id, user_id) values (v_team, auth.uid());
  perform public.add_to_team_conversation(v_team, auth.uid());
  -- they're on a team now, so their own outgoing join requests are void
  update public.invites set status = 'cancelled', responded_at = now()
   where student_id = auth.uid() and status = 'pending';
  return v_team;
end $$;

create or replace function public.update_team(p_name text, p_track text, p_needs text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if public.my_team_id() is null then raise exception 'You are not on a team.'; end if;
  update public.teams set name = trim(p_name), track = p_track, needs = p_needs
  where id = public.my_team_id();
end $$;

-- Team member invites a student
create or replace function public.send_invite(p_student uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_team uuid := public.my_team_id(); v_problem text; v_id uuid; v_open int;
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
  select count(*) into v_open from public.invites where team_id = v_team and status = 'pending';
  if v_open >= (public.settings()).max_pending_invites then
    raise exception 'Your team already has % open invites. Wait for answers or cancel one.', v_open; end if;
  insert into public.invites (team_id, student_id, kind, sent_by, expires_at)
  values (v_team, p_student, 'invite', auth.uid(), now() + make_interval(hours => (public.settings()).invite_hours))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'There is already an open invite between you and that student.';
end $$;

-- Student asks to join a team
create or replace function public.request_to_join(p_team uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_problem text; v_id uuid;
begin
  perform public.expire_old_invites();
  perform public.require_ready_student(auth.uid());
  if public.my_team_id() is not null then raise exception 'You are already on a team.'; end if;
  if (select locked_at from public.teams where id = p_team) is not null then
    raise exception 'That team is locked in.'; end if;
  v_problem := public.team_add_problem(p_team, auth.uid());
  if v_problem is not null then raise exception '%', v_problem; end if;
  insert into public.invites (team_id, student_id, kind, sent_by, expires_at)
  values (p_team, auth.uid(), 'request', auth.uid(), now() + make_interval(hours => (public.settings()).invite_hours))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'There is already an open request between you and that team.';
end $$;

-- Accept or decline. Invites are answered by the student; requests by any team member.
create or replace function public.respond_invite(p_invite uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare i public.invites; v_problem text;
begin
  perform public.expire_old_invites();
  select * into i from public.invites where id = p_invite for update;
  if i.id is null then raise exception 'Invite not found.'; end if;
  if i.status <> 'pending' then raise exception 'This invite is already %.', i.status; end if;

  if i.kind = 'invite' and i.student_id <> auth.uid() then raise exception 'This invite is not for you.'; end if;
  if i.kind = 'request' and coalesce(public.my_team_id() <> i.team_id, true) then
    raise exception 'Only members of that team can answer this request.'; end if;

  if not p_accept then
    update public.invites set status = 'declined', responded_at = now() where id = i.id;
    return;
  end if;

  if (select locked_at from public.teams where id = i.team_id) is not null then
    raise exception 'That team is locked in.'; end if;
  if exists (select 1 from public.team_members where user_id = i.student_id) then
    raise exception 'That student already joined another team.'; end if;
  v_problem := public.team_add_problem(i.team_id, i.student_id);
  if v_problem is not null then raise exception '%', v_problem; end if;

  insert into public.team_members (team_id, user_id) values (i.team_id, i.student_id);
  perform public.add_to_team_conversation(i.team_id, i.student_id);
  update public.invites set status = 'accepted', responded_at = now() where id = i.id;
  -- the student is taken: close their other open invites/requests
  update public.invites set status = 'cancelled', responded_at = now()
   where student_id = i.student_id and status = 'pending';
  -- team is full: close the team's other open invites
  if (select count(*) from public.team_members where team_id = i.team_id) >= 4 then
    update public.invites set status = 'cancelled', responded_at = now()
     where team_id = i.team_id and status = 'pending';
  end if;
end $$;

create or replace function public.cancel_invite(p_invite uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.invites set status = 'cancelled', responded_at = now()
  where id = p_invite and status = 'pending'
    and (sent_by = auth.uid() or team_id = public.my_team_id());
end $$;

create or replace function public.leave_team()
returns void language plpgsql security definer set search_path = public
as $$
declare v_team uuid := public.my_team_id();
begin
  if v_team is null then raise exception 'You are not on a team.'; end if;
  if (select locked_at from public.teams where id = v_team) is not null then
    raise exception 'Your team is locked in. Ask an organizer to make changes.'; end if;
  delete from public.team_members where user_id = auth.uid();
  delete from public.conversation_members cm using public.conversations c
   where cm.conversation_id = c.id and c.team_id = v_team and cm.user_id = auth.uid();
  if not exists (select 1 from public.team_members where team_id = v_team) then
    delete from public.teams where id = v_team;
  end if;
end $$;

create or replace function public.lock_team()
returns void language plpgsql security definer set search_path = public
as $$
declare v_team uuid := public.my_team_id(); v_problem text;
begin
  if v_team is null then raise exception 'You are not on a team.'; end if;
  v_problem := public.team_lock_problem(v_team);
  if v_problem is not null then raise exception '%', v_problem; end if;
  update public.teams set locked_at = now() where id = v_team and locked_at is null;
  update public.invites set status = 'cancelled', responded_at = now()
   where team_id = v_team and status = 'pending';
end $$;

-- Find or create a 1:1 conversation
create or replace function public.start_direct_conversation(p_other uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_key text; v_conv uuid;
begin
  if p_other = auth.uid() then raise exception 'You cannot message yourself.'; end if;
  perform public.require_ready_student(auth.uid());
  if not exists (select 1 from public.profiles where id = p_other and onboarded_at is not null) then
    raise exception 'Student not found.'; end if;
  v_key := least(auth.uid()::text, p_other::text) || ':' || greatest(auth.uid()::text, p_other::text);
  select id into v_conv from public.conversations where direct_key = v_key;
  if v_conv is null then
    insert into public.conversations (kind, direct_key) values ('direct', v_key) returning id into v_conv;
    insert into public.conversation_members (conversation_id, user_id)
    values (v_conv, auth.uid()), (v_conv, p_other);
  end if;
  return v_conv;
end $$;

create or replace function public.mark_read(p_conversation uuid)
returns void language sql security definer set search_path = public
as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid();
$$;

-- Conversations list with unread counts for the signed-in student
create or replace function public.my_conversations()
returns table (
  conversation_id uuid, kind text, title text, last_body text, last_at timestamptz, unread int
) language sql stable security definer set search_path = public
as $$
  select c.id, c.kind,
    case when c.kind = 'team' then (select t.name from public.teams t where t.id = c.team_id)
         else (select p.full_name from public.conversation_members om
               join public.profiles p on p.id = om.user_id
               where om.conversation_id = c.id and om.user_id <> auth.uid() limit 1) end,
    lm.body, lm.created_at,
    (select count(*)::int from public.messages m
      where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.created_at > cm.last_read_at)
  from public.conversation_members cm
  join public.conversations c on c.id = cm.conversation_id
  left join lateral (select body, created_at from public.messages m
                     where m.conversation_id = c.id order by created_at desc limit 1) lm on true
  where cm.user_id = auth.uid()
  order by lm.created_at desc nulls last;
$$;

-- Students to email about unread messages (service role only, used by the cron route).
-- Emails once per conversation per batch of unread messages, after they sit unread p_minutes.
create or replace function public.unread_message_digest(p_minutes int default 15)
returns table (user_id uuid, email text, full_name text, unread int, conversations int)
language sql stable security definer set search_path = public
as $$
  select p.id, p.email::text, p.full_name, sum(x.n)::int, count(*)::int
  from (
    select cm.user_id, cm.conversation_id, count(*) as n
    from public.conversation_members cm
    join public.messages m on m.conversation_id = cm.conversation_id
    where m.sender_id <> cm.user_id
      and m.created_at > cm.last_read_at
      and m.created_at > coalesce(cm.last_emailed_at, '-infinity')
      and m.created_at < now() - make_interval(mins => p_minutes)
    group by 1, 2
  ) x join public.profiles p on p.id = x.user_id
  group by p.id, p.email, p.full_name;
$$;

create or replace function public.mark_digest_sent(p_users uuid[])
returns void language sql security definer set search_path = public
as $$
  update public.conversation_members set last_emailed_at = now() where user_id = any(p_users);
$$;

-- =====================================================================
-- What other students can see. `year` and `email` are NOT in this view.
-- Only finished, paid profiles show up in search.
-- =====================================================================
create or replace view public.student_directory as
  select p.id, p.full_name, p.school_id, s.name as school_name, public.school_group(p.school_id) as school_group,
         p.study_area, p.skills, p.interests, p.tracks, p.bio, p.looking_for_team, p.linkedin_url,
         tm.team_id, t.name as team_name
  from public.profiles p
  join public.schools s on s.id = p.school_id
  left join public.team_members tm on tm.user_id = p.id
  left join public.teams t on t.id = tm.team_id
  where p.onboarded_at is not null
    and (p.paid_at is not null or not (select require_payment from public.app_settings limit 1));

-- =====================================================================
-- Row-level security
-- =====================================================================
alter table public.app_settings         enable row level security;
alter table public.schools              enable row level security;
alter table public.school_domains       enable row level security;
alter table public.profiles             enable row level security;
alter table public.teams                enable row level security;
alter table public.team_members         enable row level security;
alter table public.invites              enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.payments             enable row level security;

create policy "settings readable" on public.app_settings for select using (true);
create policy "schools readable"  on public.schools for select using (true);
create policy "domains readable"  on public.school_domains for select using (true);

-- Own profile only (others go through student_directory). Admins see all.
create policy "read own profile"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "teams readable"   on public.teams for select to authenticated using (true);
create policy "members readable" on public.team_members for select to authenticated using (true);

create policy "see my invites" on public.invites for select to authenticated
  using (student_id = auth.uid() or team_id = public.my_team_id() or public.is_admin());

-- (security definer helper avoids RLS recursion on conversation_members)
create or replace function public.in_conversation(p_conversation uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.conversation_members
                     where conversation_id = p_conversation and user_id = auth.uid()); $$;

create policy "see my conversations" on public.conversations for select to authenticated
  using (public.in_conversation(conversations.id));
create policy "see conversation members" on public.conversation_members for select to authenticated
  using (public.in_conversation(conversation_members.conversation_id));

create policy "read messages in my conversations" on public.messages for select to authenticated
  using (public.in_conversation(messages.conversation_id));
create policy "send messages in my conversations" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.in_conversation(messages.conversation_id));

create policy "see own payments" on public.payments for select using (user_id = auth.uid() or public.is_admin());

-- Writes to teams/members/invites/conversations only happen through the functions above.
revoke all on public.student_directory from anon;
grant select on public.student_directory to authenticated;
revoke execute on function public.unread_message_digest(int) from public, anon, authenticated;
revoke execute on function public.mark_digest_sent(uuid[])  from public, anon, authenticated;
revoke execute on function public.expire_old_invites()      from anon;

-- Live chat updates
alter publication supabase_realtime add table public.messages;
