-- Every campus is its own school for the team rules (matching, "same school" cap, 3+ schools).
-- 0005 already cleared the 'umich' group; this makes it explicit for ANY remaining group, so
-- school_group(id) = 'school-<id>' for every campus.
update public.schools set rule_group = null where rule_group is not null;

-- Add campuses that were missing or folded into another school.
-- Kendall College of Art & Design is a Ferris State campus that shares ferris.edu (like the UM campuses
-- share umich.edu), so students on that domain pick their campus.
update public.schools set name = 'Ferris State University' where id = 12;
insert into public.schools (id, name, kind, rule_group) values
  (77, 'Kendall College of Art & Design (Ferris State)', 'public', null),
  (78, 'Siena Heights University', 'private', null)
on conflict do nothing;
insert into public.school_domains (domain, school_id) values
  ('kcad.edu', 77), ('ferris.edu', 77),
  ('sienaheights.edu', 78)
on conflict do nothing;

-- Explicit ids above bypass the serial; keep it ahead of them for future inserts.
select setval(pg_get_serial_sequence('public.schools', 'id'), (select max(id) from public.schools));
