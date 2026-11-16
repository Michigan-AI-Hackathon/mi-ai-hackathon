-- =====================================================================
-- School sponsorship. A school (or a company on its behalf) can pay for part or all of its students' tickets.
-- Tiers are data: each has a label and the percent of the ticket the sponsor covers (A = 100, B = 50, C = 0 to start).
-- Organizers map schools to tiers. A student's discount comes ONLY from the school on their verified profile,
-- computed in here. The browser never sends a price or a percent.
--
-- Same pattern as 0008/0016: the new tables are closed (RLS on, no grants) and everything goes through
-- security-definer functions. Students can ask for their own quote and nothing else.
-- =====================================================================

create table public.pricing_tiers (
  code        text primary key check (code ~ '^[A-Z0-9]{1,3}$'),
  label       text not null check (char_length(label) between 1 and 40),
  subsidy_pct int  not null check (subsidy_pct between 0 and 100),
  position    int  not null default 0
);
insert into public.pricing_tiers (code, label, subsidy_pct, position) values
  ('A', 'Full sponsor', 100, 1),
  ('B', 'Half sponsor',  50, 2),
  ('C', 'No sponsor',     0, 3);

-- One row per sponsored school. No row = nobody covers anything.
create table public.school_sponsorship (
  school_id    int primary key references public.schools(id) on delete cascade,
  tier         text not null references public.pricing_tiers(code),
  sponsor_name text check (sponsor_name is null or char_length(sponsor_name) <= 80),
  seat_cap     int  check (seat_cap is null or seat_cap >= 0),   -- sponsored tickets the school paid for; null = no limit
  updated_at   timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['pricing_tiers', 'school_sponsorship'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- What was charged and who covered the rest, kept on the payment so a sponsor can be invoiced later even
-- if the tier is edited. Old rows leave these empty.
alter table public.payments
  add column base_cents    int,
  add column subsidy_pct   int,
  add column subsidy_cents int,
  add column school_id     int references public.schools(id) on delete set null,
  add column tier          text;
create index payments_school on public.payments (school_id) where school_id is not null;

-- ---------- The quote ----------
-- Percent the student's school covers right now. 0 when the school has no sponsorship, the student has no school
-- yet, or the school has used up the seats it paid for.
create or replace function public._sponsorship_for(p_user uuid)
returns table (school_id int, tier text, label text, pct int, seat_cap int, seats_used int, seats_left int)
language sql stable security definer set search_path = public
as $$
  select p.school_id, s.tier, t.label,
         case when s.school_id is null then 0
              when s.seat_cap is not null and u.n >= s.seat_cap then 0
              else t.subsidy_pct end,
         s.seat_cap, coalesce(u.n, 0),
         case when s.seat_cap is null then null else greatest(s.seat_cap - coalesce(u.n, 0), 0) end
  from public.profiles p
  left join public.school_sponsorship s on s.school_id = p.school_id
  left join public.pricing_tiers t on t.code = s.tier
  left join lateral (select count(*)::int n from public.payments x
                      where x.school_id = p.school_id and coalesce(x.subsidy_pct, 0) > 0 and x.status = 'paid') u on true
  where p.id = p_user;
$$;
revoke all on function public._sponsorship_for(uuid) from public, anon, authenticated;

-- The signed-in student's own quote. Returns a school's tier name and percent, never another school's data.
create or replace function public.my_sponsorship()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare q record;
begin
  select * into q from public._sponsorship_for(auth.uid());
  if q.school_id is null then return jsonb_build_object('subsidy_pct', 0); end if;
  return jsonb_build_object('school_id', q.school_id, 'tier', q.tier, 'label', q.label, 'subsidy_pct', coalesce(q.pct, 0), 'seats_left', q.seats_left);
end $$;

-- ---------- Claim a fully covered ticket (no Stripe) ----------
-- Called only by the server (service role) after it works out the base price. p_base_cents is what the ticket
-- would have cost, recorded so the sponsor's bill is exact. Safe to call twice.
create or replace function public.claim_sponsored_registration(p_user uuid, p_base_cents int)
returns boolean language plpgsql security definer set search_path = public
as $$
declare p public.profiles; q record;
begin
  if p_base_cents is null or p_base_cents < 0 then raise exception 'Bad price.'; end if;
  select * into p from public.profiles where id = p_user for update;
  if p.id is null then raise exception 'Student not found.'; end if;
  if p.paid_at is not null then return false; end if;
  if p.school_id is null then raise exception 'Choose your school first.'; end if;
  -- one claim at a time per school so the seat cap can't be overshot
  perform pg_advisory_xact_lock(hashtext('sponsor-seat-' || p.school_id));
  select * into q from public._sponsorship_for(p_user);
  if coalesce(q.pct, 0) < 100 then raise exception 'Your school no longer covers the full fee.'; end if;
  insert into public.payments (user_id, stripe_session_id, amount_cents, base_cents, subsidy_pct, subsidy_cents, school_id, tier)
  values (p_user, 'sponsor-' || gen_random_uuid(), 0, p_base_cents, 100, p_base_cents, p.school_id, q.tier);
  update public.profiles set paid_at = now() where id = p_user;
  return true;
end $$;
revoke all on function public.claim_sponsored_registration(uuid, int) from public, anon, authenticated;
grant execute on function public.claim_sponsored_registration(uuid, int) to service_role;

-- ---------- Organizer ----------
create or replace function public.admin_save_tier(p_code text, p_label text, p_pct int)
returns void language plpgsql security definer set search_path = public
as $$
declare v_code text := upper(trim(coalesce(p_code, ''))); v_old int;
begin
  perform public.require_admin();
  if v_code !~ '^[A-Z0-9]{1,3}$' then raise exception 'A tier code is 1 to 3 letters or numbers.'; end if;
  if p_pct is null or p_pct not between 0 and 100 then raise exception 'The percent covered must be from 0 to 100.'; end if;
  if char_length(trim(coalesce(p_label, ''))) not between 1 and 40 then raise exception 'Give the tier a short name.'; end if;
  select subsidy_pct into v_old from public.pricing_tiers where code = v_code;
  insert into public.pricing_tiers (code, label, subsidy_pct, position)
  values (v_code, trim(p_label), p_pct, coalesce((select max(position) + 1 from public.pricing_tiers), 1))
  on conflict (code) do update set label = excluded.label, subsidy_pct = excluded.subsidy_pct;
  perform public.log_admin('save_tier', jsonb_build_object('tier', v_code, 'label', trim(p_label), 'pct', p_pct, 'was', v_old));
end $$;

-- Put a school on a tier (or off one, with a null tier). p_whole_group also applies it to every school that shares an
-- email domain with it. Students at umich.edu (and ferris.edu) pick their own campus, so without this a student could
-- pick the best-priced one. Students who already paid keep what they paid.
create or replace function public.admin_set_school_sponsorship(p_school int, p_tier text, p_sponsor text, p_seat_cap int, p_whole_group boolean default true)
returns int language plpgsql security definer set search_path = public
as $$
declare v_ids int[]; v_tier text := nullif(upper(trim(coalesce(p_tier, ''))), '');
begin
  perform public.require_admin();
  if not exists (select 1 from public.schools where id = p_school) then raise exception 'School not found.'; end if;
  select array_agg(distinct i) into v_ids from (
    select p_school i
    union
    select d2.school_id from public.school_domains d1 join public.school_domains d2 on d2.domain = d1.domain
     where coalesce(p_whole_group, true) and d1.school_id = p_school) x;
  if v_tier is null then
    delete from public.school_sponsorship where school_id = any(v_ids);
  else
    if not exists (select 1 from public.pricing_tiers where code = v_tier) then raise exception 'Unknown tier.'; end if;
    if p_seat_cap is not null and p_seat_cap < 0 then raise exception 'Seats can''t be negative.'; end if;
    insert into public.school_sponsorship (school_id, tier, sponsor_name, seat_cap)
    select i, v_tier, nullif(left(trim(coalesce(p_sponsor, '')), 80), ''), p_seat_cap from unnest(v_ids) i
    on conflict (school_id) do update set tier = excluded.tier, sponsor_name = excluded.sponsor_name,
                                          seat_cap = excluded.seat_cap, updated_at = now();
  end if;
  perform public.log_admin('set_school_sponsorship', jsonb_build_object('schools', v_ids, 'tier', v_tier, 'sponsor', left(coalesce(p_sponsor, ''), 80), 'seat_cap', p_seat_cap));
  return coalesce(array_length(v_ids, 1), 0);
end $$;

-- Everything the sponsors page needs, in one read.
create or replace function public.admin_sponsorship_data()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'tiers', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'label', label, 'pct', subsidy_pct) order by position, code), '[]') from public.pricing_tiers),
    'schools', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'kind', s.kind,
        'tier', sp.tier, 'sponsor', sp.sponsor_name, 'seat_cap', sp.seat_cap,
        'students',     (select count(*) from public.profiles p where p.school_id = s.id),
        'paid',         (select count(*) from public.profiles p where p.school_id = s.id and p.paid_at is not null),
        'sponsored',    (select count(*) from public.payments x where x.school_id = s.id and coalesce(x.subsidy_pct, 0) > 0 and x.status = 'paid'),
        'free',         (select count(*) from public.payments x where x.school_id = s.id and x.subsidy_pct = 100 and x.status = 'paid'),
        'subsidy_cents',(select coalesce(sum(x.subsidy_cents), 0) from public.payments x where x.school_id = s.id and x.status = 'paid'),
        'student_cents',(select coalesce(sum(x.amount_cents), 0) from public.payments x where x.school_id = s.id and x.status = 'paid')
      ) order by s.name), '[]')
      from public.schools s left join public.school_sponsorship sp on sp.school_id = s.id)
  );
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'my_sponsorship()', 'admin_save_tier(text,text,int)', 'admin_set_school_sponsorship(int,text,text,int,boolean)', 'admin_sponsorship_data()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
