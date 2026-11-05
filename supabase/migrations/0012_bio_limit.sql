-- Bios are capped at 100 characters. Trim existing long ones first.
update public.profiles set bio = left(bio, 100) where char_length(bio) > 100;
alter table public.profiles drop constraint if exists bio_len;
alter table public.profiles add constraint bio_len check (char_length(coalesce(bio,'')) <= 100);
