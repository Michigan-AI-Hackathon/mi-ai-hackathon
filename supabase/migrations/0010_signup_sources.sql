-- =====================================================================
-- Pre-hackathon events: each event gets its own QR code. Scanning it opens /join/<slug>, and a student who
-- signs up afterwards is credited to that event ("first touch", only for brand-new accounts).
-- =====================================================================
alter table public.profiles add column signup_source text;

-- Students can't write signup_source themselves (only claim_signup_source can).
create or replace function public.protect_profile_columns()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user in ('authenticated','anon') then
    new.email := old.email;  new.is_admin := old.is_admin;
    new.paid_at := old.paid_at;  new.created_at := old.created_at;
    new.checked_in_at := old.checked_in_at;  new.signup_source := old.signup_source;
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

create table public.signup_sources (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name        text not null check (char_length(name) between 2 and 80),
  event_date  date,
  active      boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.signup_sources enable row level security;
create policy "organizers read sources" on public.signup_sources for select to authenticated using (public.is_admin());
revoke all on public.signup_sources from anon, authenticated;
grant select on public.signup_sources to authenticated;

-- Public: the join page asks for the event name (and nothing else) for an active code.
create or replace function public.source_info(p_slug text)
returns jsonb language sql stable security definer set search_path = public
as $$ select jsonb_build_object('name', name, 'event_date', event_date) from public.signup_sources where slug = lower(p_slug) and active; $$;

-- A new student claims the event they came from. First touch wins; accounts older than 2 days can't be re-credited.
create or replace function public.claim_signup_source(p_slug text)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set signup_source = lower(p_slug)
   where id = auth.uid() and signup_source is null and created_at > now() - interval '2 days'
     and exists (select 1 from public.signup_sources where slug = lower(p_slug) and active);
  return found;
end $$;

create or replace function public.admin_create_source(p_name text, p_date date default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_slug text; v_id uuid;
begin
  perform public.require_admin();
  v_slug := left(trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g')), 28);
  if char_length(v_slug) < 2 then v_slug := 'event'; end if;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5);   -- random tail: codes can't be guessed
  insert into public.signup_sources (slug, name, event_date, created_by) values (v_slug, trim(p_name), p_date, auth.uid()) returning id into v_id;
  perform public.log_admin('create_event', jsonb_build_object('name', trim(p_name), 'slug', v_slug));
  return jsonb_build_object('id', v_id, 'slug', v_slug);
end $$;

create or replace function public.admin_set_source_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  update public.signup_sources set active = p_active where id = p_id;
  if not found then raise exception 'Event not found.'; end if;
  perform public.log_admin(case when p_active then 'event_code_on' else 'event_code_off' end, jsonb_build_object('id', p_id));
end $$;

create or replace function public.admin_source_stats()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'sources', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'slug', s.slug, 'name', s.name, 'event_date', s.event_date, 'active', s.active,
        'signups', (select count(*) from public.profiles p where p.signup_source = s.slug),
        'finished', (select count(*) from public.profiles p where p.signup_source = s.slug and p.onboarded_at is not null),
        'paid', (select count(*) from public.profiles p where p.signup_source = s.slug and p.paid_at is not null)
      ) order by s.created_at desc), '[]') from public.signup_sources s),
    'direct', (select count(*) from public.profiles where signup_source is null));
end $$;

do $$
declare f text;
begin
  foreach f in array array['claim_signup_source(text)', 'admin_create_source(text,date)', 'admin_set_source_active(uuid,boolean)', 'admin_source_stats()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  revoke all on function public.source_info(text) from public;
  grant execute on function public.source_info(text) to anon, authenticated;
end $$;
