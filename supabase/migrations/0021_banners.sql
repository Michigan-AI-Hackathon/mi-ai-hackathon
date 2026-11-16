-- =====================================================================
-- Homepage banners. An organizer writes a short message (optionally with a link) and picks who sees it.
-- Same pattern as 0016/0019: the table is closed, students ask for "their" banners through one function that
-- works out the audience on the server, and organizers manage them through functions that check is_admin().
-- =====================================================================
create table public.banners (
  id         uuid primary key default gen_random_uuid(),
  message    text not null check (char_length(message) between 1 and 240),
  link_url   text check (link_url is null or link_url ~ '^(https://|/)[^\s]*$'),
  link_label text check (link_label is null or char_length(link_label) <= 30),
  audience   text not null default 'all' check (audience in ('all', 'unpaid', 'paid', 'no_team', 'on_team', 'unfinished')),
  tone       text not null default 'info' check (tone in ('info', 'warn')),
  active     boolean not null default true,
  ends_at    timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.banners enable row level security;
revoke all on public.banners from anon, authenticated;

-- The banners the signed-in person should see right now.
create or replace function public.my_banners()
returns table (id uuid, message text, link_url text, link_label text, tone text)
language sql stable security definer set search_path = public
as $$
  with me as (
    select p.paid_at is not null as paid, p.onboarded_at is not null as done,
           exists (select 1 from public.team_members tm where tm.user_id = p.id) as on_team
      from public.profiles p where p.id = auth.uid())
  select b.id, b.message, b.link_url, b.link_label, b.tone
    from public.banners b, me
   where b.active and (b.ends_at is null or b.ends_at > now())
     and case b.audience
           when 'all' then true
           when 'unpaid' then not me.paid
           when 'paid' then me.paid
           when 'no_team' then not me.on_team
           when 'on_team' then me.on_team
           when 'unfinished' then not me.done
         end
   order by b.created_at desc;
$$;

create or replace function public.admin_banners()
returns setof public.banners language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_admin();
  return query select * from public.banners order by active desc, created_at desc limit 50;
end $$;

create or replace function public.admin_save_banner(p_message text, p_link_url text, p_link_label text, p_audience text, p_tone text, p_ends_at timestamptz)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  perform public.require_admin();
  insert into public.banners (message, link_url, link_label, audience, tone, ends_at, created_by)
  values (trim(p_message), nullif(trim(coalesce(p_link_url, '')), ''), nullif(trim(coalesce(p_link_label, '')), ''), p_audience, p_tone, p_ends_at, auth.uid())
  returning id into v_id;
  perform public.log_admin('banner_created', jsonb_build_object('banner', v_id, 'audience', p_audience));
  return v_id;
end $$;

create or replace function public.admin_set_banner_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  update public.banners set active = p_active where id = p_id;
  if not found then raise exception 'Banner not found.'; end if;
end $$;

create or replace function public.admin_delete_banner(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  delete from public.banners where id = p_id;
  if not found then raise exception 'Banner not found.'; end if;
  perform public.log_admin('banner_deleted', jsonb_build_object('banner', p_id));
end $$;

do $$
declare f text;
begin
  foreach f in array array['my_banners()', 'admin_banners()', 'admin_save_banner(text,text,text,text,text,timestamptz)', 'admin_set_banner_active(uuid,boolean)', 'admin_delete_banner(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
