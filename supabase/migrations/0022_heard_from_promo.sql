-- =====================================================================
-- 1. "How did you hear about us?" on the profile (with the club name when it was an organization referral).
-- 2. Promo codes organizers hand out so a person can register without paying (for the organizing team, partners, guests).
-- =====================================================================

alter table public.profiles
  add column heard_from text check (heard_from in ('friend', 'organization', 'social', 'email', 'class', 'flyer', 'other')),
  add column heard_detail text check (char_length(heard_detail) <= 80);

-- ---------------------------------------------------------------------
-- Promo codes. Closed tables: nobody reads them directly, only through the functions below.
-- ---------------------------------------------------------------------
create table public.promo_codes (
  code       text primary key check (code ~ '^[A-Z0-9-]{4,24}$'),
  label      text check (char_length(label) <= 60),
  max_uses   int check (max_uses is null or max_uses > 0),
  used       int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.promo_attempts (
  id      bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  at      timestamptz not null default now()
);
create index promo_attempts_user on public.promo_attempts (user_id, at desc);
alter table public.promo_codes enable row level security;
alter table public.promo_attempts enable row level security;
revoke all on public.promo_codes, public.promo_attempts from public, anon, authenticated;
revoke all on sequence public.promo_attempts_id_seq from public, anon, authenticated;

-- Called only by the server (service role). Returns 'ok', 'invalid', 'throttled' or 'already'.
-- Wrong guesses are counted so a code can't be brute-forced: 5 misses in 10 minutes pauses that student.
create or replace function public.redeem_promo(p_user uuid, p_code text, p_base_cents int)
returns text language plpgsql security definer set search_path = public
as $$
declare p public.profiles; c public.promo_codes; v_code text := upper(trim(coalesce(p_code, '')));
begin
  select * into p from public.profiles where id = p_user for update;
  if p.id is null then raise exception 'Student not found.'; end if;
  if p.paid_at is not null then return 'already'; end if;
  if (select count(*) from public.promo_attempts where user_id = p_user and at > now() - interval '10 minutes') >= 5 then
    return 'throttled';
  end if;
  select * into c from public.promo_codes where code = v_code for update;
  if c.code is null or not c.active or (c.max_uses is not null and c.used >= c.max_uses) then
    insert into public.promo_attempts (user_id) values (p_user);
    return 'invalid';
  end if;
  update public.promo_codes set used = used + 1 where code = c.code;
  insert into public.payments (user_id, stripe_session_id, amount_cents, base_cents, subsidy_pct, subsidy_cents, tier)
  values (p_user, 'promo-' || gen_random_uuid(), 0, p_base_cents, 0, 0, 'PROMO:' || c.code);
  update public.profiles set paid_at = now() where id = p_user;
  return 'ok';
end $$;
revoke all on function public.redeem_promo(uuid, text, int) from public, anon, authenticated;
grant execute on function public.redeem_promo(uuid, text, int) to service_role;

-- ---------- Organizer ----------
create or replace function public.admin_promo_codes()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label, 'max_uses', max_uses, 'used', used, 'active', active, 'created_at', created_at)
                                    order by created_at desc) from public.promo_codes), '[]'::jsonb);
end $$;

create or replace function public.admin_save_promo(p_code text, p_label text, p_max_uses int)
returns void language plpgsql security definer set search_path = public
as $$
declare v_code text := upper(trim(coalesce(p_code, '')));
begin
  perform public.require_admin();
  if v_code !~ '^[A-Z0-9-]{4,24}$' then raise exception 'A code is 4 to 24 letters, numbers or dashes.'; end if;
  if p_max_uses is not null and p_max_uses < 1 then raise exception 'Uses must be at least 1.'; end if;
  insert into public.promo_codes (code, label, max_uses) values (v_code, nullif(left(trim(coalesce(p_label, '')), 60), ''), p_max_uses)
  on conflict (code) do update set label = excluded.label, max_uses = excluded.max_uses, active = true;
  perform public.log_admin('save_promo', jsonb_build_object('code', v_code, 'max_uses', p_max_uses));
end $$;

create or replace function public.admin_set_promo_active(p_code text, p_active boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  update public.promo_codes set active = coalesce(p_active, false) where code = upper(trim(p_code));
  perform public.log_admin('set_promo_active', jsonb_build_object('code', upper(trim(p_code)), 'active', p_active));
end $$;

do $$
declare f text;
begin
  foreach f in array array['admin_promo_codes()', 'admin_save_promo(text, text, int)', 'admin_set_promo_active(text, boolean)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
