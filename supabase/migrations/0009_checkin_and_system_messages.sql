-- =====================================================================
-- 1. QR self check-in
-- 2. Organizer announcements delivered into each student's Messages
-- =====================================================================

-- ---------- Check-in ----------
-- One row. NOT readable by students (RLS on, no policy): the token is the secret printed in the venue QR code.
create table public.checkin_config (
  id     boolean primary key default true check (id),
  open   boolean not null default false,
  token  text not null default replace(gen_random_uuid()::text, '-', '')
);
insert into public.checkin_config default values;
alter table public.checkin_config enable row level security;
revoke all on public.checkin_config from anon, authenticated;

create or replace function public.admin_checkin_config()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_admin();
  return (select jsonb_build_object('open', open, 'token', token) from public.checkin_config);
end $$;

create or replace function public.admin_set_checkin(p_open boolean, p_rotate boolean default false)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  update public.checkin_config set open = p_open,
    token = case when p_rotate then replace(gen_random_uuid()::text, '-', '') else token end;
  perform public.log_admin(case when p_rotate then 'checkin_code_rotated' when p_open then 'checkin_opened' else 'checkin_closed' end, '{}');
end $$;

-- A student scans the venue QR code. Needs: check-in open, the right token, finished profile, paid.
create or replace function public.self_check_in(p_token text)
returns void language plpgsql security definer set search_path = public
as $$
declare p public.profiles; c public.checkin_config;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then raise exception 'Sign in first.'; end if;
  select * into c from public.checkin_config;
  if not c.open then raise exception 'Check-in is not open yet.'; end if;
  if p_token is null or p_token <> c.token then raise exception 'That QR code is not valid. Ask an organizer for help.'; end if;
  if p.onboarded_at is null then raise exception 'Finish your profile first.'; end if;
  if (public.settings()).require_payment and p.paid_at is null then
    raise exception 'You have not paid the registration fee yet. Ask an organizer for help.'; end if;
  update public.profiles set checked_in_at = coalesce(checked_in_at, now()) where id = p.id;
end $$;

-- ---------- Announcements into Messages ----------
alter table public.conversations drop constraint conversations_kind_check;
alter table public.conversations add constraint conversations_kind_check check (kind in ('team','direct','system'));

-- Students can read the "Organizers" conversation but never write to it.
drop policy "send messages in my conversations" on public.messages;
create policy "send messages in my conversations" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.in_conversation(messages.conversation_id)
    and not exists (select 1 from public.conversations c where c.id = messages.conversation_id and c.kind = 'system'));

create or replace function public.admin_post_announcement(p_users uuid[], p_subject text, p_body text)
returns int language plpgsql security definer set search_path = public
as $$
declare u uuid; v_conv uuid; v_n int := 0; v_text text;
begin
  perform public.require_admin();
  if coalesce(array_length(p_users, 1), 0) > 5000 then raise exception 'Too many recipients.'; end if;
  v_text := left(trim(p_subject), 120) || E'\n\n' || left(trim(p_body), 1800);
  if char_length(v_text) < 10 then raise exception 'Write a subject and a message.'; end if;
  foreach u in array coalesce(p_users, '{}') loop
    if not exists (select 1 from public.profiles where id = u) then continue; end if;
    select id into v_conv from public.conversations where direct_key = 'system:' || u;
    if v_conv is null then
      insert into public.conversations (kind, direct_key) values ('system', 'system:' || u) returning id into v_conv;
      -- one second in the past, so a message created in this same transaction counts as unread
      insert into public.conversation_members (conversation_id, user_id, last_read_at) values (v_conv, u, now() - interval '1 second');
    end if;
    insert into public.messages (conversation_id, sender_id, body) values (v_conv, auth.uid(), v_text);
    v_n := v_n + 1;
  end loop;
  perform public.log_admin('announcement_inbox', jsonb_build_object('recipients', v_n, 'subject', left(trim(p_subject), 120)));
  return v_n;
end $$;

-- Conversation list: the system conversation is titled "Organizers".
create or replace function public.my_conversations()
returns table (
  conversation_id uuid, kind text, title text, last_body text, last_at timestamptz, unread int
) language sql stable security definer set search_path = public
as $$
  select c.id, c.kind,
    case when c.kind = 'team' then (select t.name from public.teams t where t.id = c.team_id)
         when c.kind = 'system' then 'Organizers'
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

-- Organizer announcements already go out by email, so don't also send "you have unread messages" emails for them.
create or replace function public.unread_message_digest(p_minutes int default 15)
returns table (user_id uuid, email text, full_name text, unread int, conversations int)
language sql stable security definer set search_path = public
as $$
  select p.id, p.email::text, p.full_name, sum(x.n)::int, count(*)::int
  from (
    select cm.user_id, cm.conversation_id, count(*) as n
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id and c.kind <> 'system'
    join public.messages m on m.conversation_id = cm.conversation_id
    where m.sender_id <> cm.user_id
      and m.created_at > cm.last_read_at
      and m.created_at > coalesce(cm.last_emailed_at, '-infinity')
      and m.created_at < now() - make_interval(mins => p_minutes)
    group by 1, 2
  ) x join public.profiles p on p.id = x.user_id
  group by p.id, p.email, p.full_name;
$$;
revoke execute on function public.unread_message_digest(int) from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array['admin_checkin_config()', 'admin_set_checkin(boolean,boolean)', 'admin_post_announcement(uuid[],text,text)', 'self_check_in(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
