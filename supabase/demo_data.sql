-- =====================================================================
-- DEMO DATA for testing (16 students, 3 teams). NOT for production.
-- Every demo email starts with "demo-". Demo accounts can't sign in.
--
-- REMOVE all demo data:
--   delete from public.teams where id in (
--     select tm.team_id from public.team_members tm join public.profiles p on p.id = tm.user_id
--     where p.email like 'demo-%');
--   delete from public.conversations where direct_key is not null and id in (
--     select cm.conversation_id from public.conversation_members cm join public.profiles p on p.id = cm.user_id
--     where p.email like 'demo-%');
--   delete from auth.users where email like 'demo-%';
--
-- LOAD: run step 1, then step 2, then step 3 (separately, in the SQL editor).
-- =====================================================================

-- Step 1: accounts (the sign-up trigger creates their profiles)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', e, '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'
from unnest(array[
 'demo-maya.chen@wayne.edu','demo-jordan.ellis@msu.edu','demo-priya.nair@kzoo.edu','demo-luis.ramirez@gvsu.edu',
 'demo-hannah.kowalski@davenport.edu','demo-andre.thompson@oakland.edu','demo-emily.zhang@mtu.edu','demo-marcus.reed@kettering.edu',
 'demo-sofia.alvarez@ltu.edu','demo-kevin.osei@macomb.edu','demo-ava.patel@umich.edu','demo-noah.williams@emich.edu',
 'demo-grace.kim@ccsdetroit.edu','demo-omar.haddad@hfcc.edu','demo-lily.nguyen@cmich.edu','demo-ethan.brooks@hope.edu']) e;

-- Step 2: fill in their profiles (finished and paid, so they show up in search)
with demo(email, full_name, study, skills, interests, tracks, bio, year) as (values
 ('demo-maya.chen@wayne.edu','Maya Chen','Nursing', array['Healthcare','Research'], array['Health','Social impact'], array['HealthTech'], 'Nurse in training. I know what hospitals actually need. Looking for a builder and a designer.', 'Third year'),
 ('demo-jordan.ellis@msu.edu','Jordan Ellis','Computer science', array['Backend','Machine learning'], array['Startups','Health'], array['HealthTech','FinTech'], 'Backend and ML. Happy to own the technical side.', 'Fourth year'),
 ('demo-priya.nair@kzoo.edu','Priya Nair','Economics', array['Business strategy','Pitching'], array['Startups','Education'], array['HealthTech'], 'I can run the pitch and the business model.', 'Second year'),
 ('demo-luis.ramirez@gvsu.edu','Luis Ramirez','Finance', array['Finance','Data analysis'], array['Fintech','Startups'], array['FinTech'], 'Finance major who lives in spreadsheets. Want to build something for students and money.', 'Third year'),
 ('demo-hannah.kowalski@davenport.edu','Hannah Kowalski','Accounting', array['Finance','Product management'], array['Fintech'], array['FinTech'], 'Looking for a team that wants to make budgeting less painful.', 'Fourth year'),
 ('demo-andre.thompson@oakland.edu','Andre Thompson','Information technology', array['Frontend','Mobile'], array['Fintech','Gaming'], array['FinTech','SportsTech'], 'Frontend and mobile. I ship fast.', 'Second year'),
 ('demo-emily.zhang@mtu.edu','Emily Zhang','Mechanical engineering', array['Hardware','Research'], array['Manufacturing','Climate'], array['Industry 4.0'], 'Hardware and sensors. Interested in smart factories.', 'Third year'),
 ('demo-marcus.reed@kettering.edu','Marcus Reed','Industrial engineering', array['Data analysis','Product management'], array['Manufacturing'], array['Industry 4.0'], 'Co-op at an auto supplier. Know the factory floor.', 'Fourth year'),
 ('demo-sofia.alvarez@ltu.edu','Sofia Alvarez','Architecture', array['UI/UX design','Writing'], array['Creative tools','Manufacturing'], array['Industry 4.0','SportsTech'], 'Designer. I make things look and feel right.', 'Third year'),
 ('demo-kevin.osei@macomb.edu','Kevin Osei','Computer information systems', array['Backend','Data analysis'], array['Manufacturing','Gaming'], array['Industry 4.0'], 'Macomb CIS student, learning fast, love data pipelines.', 'Second year'),
 ('demo-ava.patel@umich.edu','Ava Patel','Business administration', array['Marketing','Pitching'], array['Sports','Startups'], array['SportsTech'], 'Ross student. Want to build something for college athletes.', 'Second year'),
 ('demo-noah.williams@emich.edu','Noah Williams','Exercise science', array['Healthcare','Research'], array['Sports','Health'], array['SportsTech','HealthTech'], 'Athlete and exercise science major. I know the users.', 'Fourth year'),
 ('demo-grace.kim@ccsdetroit.edu','Grace Kim','Product design', array['UI/UX design','Marketing'], array['Creative tools','Social impact'], array['HealthTech','SportsTech'], 'Product designer at CCS. Looking for a technical team that cares about design.', 'Third year'),
 ('demo-omar.haddad@hfcc.edu','Omar Haddad','Computer science', array['Frontend','Machine learning'], array['Education','Gaming'], array['FinTech','Industry 4.0'], 'Henry Ford College CS. Built two side projects with LLM APIs.', 'Second year'),
 ('demo-lily.nguyen@cmich.edu','Lily Nguyen','Public health', array['Research','Writing'], array['Health','Social impact'], array['HealthTech'], 'Public health research. Good at user interviews.', 'First year'),
 ('demo-ethan.brooks@hope.edu','Ethan Brooks','Mathematics', array['Data analysis','Machine learning'], array['Sports','Fintech'], array['SportsTech','FinTech'], 'Math and stats. I like sports analytics.', 'Third year')
)
update public.profiles p set
  full_name = d.full_name, study_area = d.study, skills = d.skills, interests = d.interests, tracks = d.tracks,
  bio = d.bio, year = d.year, looking_for_team = true, onboarded_at = now(), paid_at = now(),
  school_id = coalesce(p.school_id, (select id from public.schools where name = 'University of Michigan – Ann Arbor'))
from demo d where p.email = d.email;

-- Step 3: three teams (two open, one full and locked), a team chat message,
-- plus an invite and a direct message for sebascas@umich.edu (change the email to test as someone else)
do $$
declare
  t1 uuid; t2 uuid; t3 uuid; dm uuid; pid uuid; u text;
  me uuid := (select id from public.profiles where email = 'sebascas@umich.edu');
begin
  insert into public.teams (name, track, needs, created_by)
  values ('Motor City Health', 'HealthTech', 'A designer, and anyone who has worked in a clinic',
          (select id from public.profiles where email='demo-maya.chen@wayne.edu')) returning id into t1;
  foreach u in array array['demo-maya.chen@wayne.edu','demo-jordan.ellis@msu.edu','demo-priya.nair@kzoo.edu'] loop
    select id into pid from public.profiles where email = u;
    insert into public.team_members (team_id, user_id) values (t1, pid);
    perform public.add_to_team_conversation(t1, pid);
  end loop;

  insert into public.teams (name, track, needs, created_by)
  values ('Ledger Lab', 'FinTech', 'Someone strong in machine learning',
          (select id from public.profiles where email='demo-luis.ramirez@gvsu.edu')) returning id into t2;
  foreach u in array array['demo-luis.ramirez@gvsu.edu','demo-hannah.kowalski@davenport.edu','demo-andre.thompson@oakland.edu'] loop
    select id into pid from public.profiles where email = u;
    insert into public.team_members (team_id, user_id) values (t2, pid);
    perform public.add_to_team_conversation(t2, pid);
  end loop;

  insert into public.teams (name, track, needs, created_by, locked_at)
  values ('Line Speed', 'Industry 4.0', null,
          (select id from public.profiles where email='demo-emily.zhang@mtu.edu'), now()) returning id into t3;
  foreach u in array array['demo-emily.zhang@mtu.edu','demo-marcus.reed@kettering.edu','demo-sofia.alvarez@ltu.edu','demo-kevin.osei@macomb.edu'] loop
    select id into pid from public.profiles where email = u;
    insert into public.team_members (team_id, user_id) values (t3, pid);
    perform public.add_to_team_conversation(t3, pid);
  end loop;

  insert into public.messages (conversation_id, sender_id, body)
  select c.id, p.id, 'Welcome! Who wants to take the pitch?'
  from public.conversations c, public.profiles p where c.team_id = t1 and p.email = 'demo-maya.chen@wayne.edu';

  if me is not null then
    insert into public.invites (team_id, student_id, kind, sent_by, expires_at)
    values (t2, me, 'invite', (select id from public.profiles where email='demo-luis.ramirez@gvsu.edu'), now() + interval '48 hours');
    select id into pid from public.profiles where email = 'demo-grace.kim@ccsdetroit.edu';
    insert into public.conversations (kind, direct_key)
    values ('direct', least(me::text, pid::text) || ':' || greatest(me::text, pid::text)) returning id into dm;
    insert into public.conversation_members (conversation_id, user_id, last_read_at)
    values (dm, me, now() - interval '1 day'), (dm, pid, now());
    insert into public.messages (conversation_id, sender_id, body)
    values (dm, pid, 'Hi Sebastian! I saw your profile. I''m a product designer at CCS looking for a technical team. Want to team up?');
  end if;
end $$;
