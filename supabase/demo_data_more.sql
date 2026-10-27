-- =====================================================================
-- MORE DEMO STUDENTS (40 random, finished + paid, NOT on any team). NOT for production.
-- Emails start with "demo-" so the cleanup in demo_data.sql removes them too:
--   delete from auth.users where email like 'demo-%';
-- Safe to run more than once; each run adds 40 more people.
-- Run in the Supabase SQL editor (one go).
-- =====================================================================
do $$
declare
  firsts text[] := array['Aaliyah','Ben','Camila','Dev','Elena','Felix','Gabi','Hiro','Imani','Jake','Kayla','Liam','Mei','Nate','Olivia','Pablo','Quinn','Rhea','Sam','Tara','Uma','Victor','Wen','Xavier','Yara','Zane'];
  lasts  text[] := array['Adams','Bauer','Castillo','Dang','Evans','Foster','Gupta','Hughes','Ito','Jackson','Khan','Lopez','Morgan','Nguyen','Ortiz','Park','Reyes','Singh','Tran','Usher','Vega','Walsh','Young','Zimmer'];
  majors text[] := array['Computer science','Data science','Electrical engineering','Biomedical engineering','Business administration','Finance','Economics','Public health','Nursing','Industrial design','Graphic design','Statistics','Kinesiology','Mechanical engineering','Information systems','Psychology'];
  v_skills text[] := array['Frontend','Backend','Mobile','Machine learning','Data analysis','Product management','UI/UX design','Business strategy','Finance','Marketing','Pitching','Healthcare','Hardware','Research','Writing'];
  v_ints text[] := array['Startups','Social impact','Sports','Health','Fintech','Manufacturing','Education','Climate','Gaming','Creative tools'];
  v_trks text[] := array['FinTech','HealthTech','SportsTech','Industry 4.0'];
  yrs    text[] := array['First year','Second year','Third year','Fourth year','Fifth year or more','Graduate student'];
  bios   text[] := array[
    'Looking for a team that ships fast.',
    'First hackathon, eager to learn and carry my weight.',
    'I like turning messy problems into clear demos.',
    'Happy to take the technical lead or the pitch, whichever the team needs.',
    'Want to build something real that people would actually use.',
    'Strong on research and user interviews, looking for builders.'];
  -- single-campus domains only, so every student gets a school
  doms text[] := array(select domain from public.school_domains group by domain having count(*) = 1);
  i int; f text; l text; e text; n int := 0;
begin
  for i in 1..40 loop
    f := firsts[1 + floor(random() * array_length(firsts, 1))::int];
    l := lasts[1 + floor(random() * array_length(lasts, 1))::int];
    e := lower('demo-' || f || '.' || l || floor(random() * 900 + 100)::int || '@'
               || doms[1 + floor(random() * array_length(doms, 1))::int]);
    begin
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
      values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', e, '', now(), now(), now(),
              '{"provider":"email","providers":["email"]}', '{}');
    exception when others then continue;  -- duplicate email, skip
    end;

    update public.profiles set
      full_name = f || ' ' || l,
      study_area = majors[1 + floor(random() * array_length(majors, 1))::int],
      skills = (select array_agg(s) from (select s from unnest(v_skills) s order by random() limit 2 + floor(random() * 2)::int) x),
      interests = (select array_agg(s) from (select s from unnest(v_ints) s order by random() limit 2) x),
      tracks = (select array_agg(s) from (select s from unnest(v_trks) s order by random() limit 1 + floor(random() * 2)::int) x),
      bio = bios[1 + floor(random() * array_length(bios, 1))::int],
      year = yrs[1 + floor(random() * array_length(yrs, 1))::int],
      looking_for_team = true, onboarded_at = now(), paid_at = now()
    where email = e;
    n := n + 1;
  end loop;
  raise notice 'Added % demo students', n;
end $$;
