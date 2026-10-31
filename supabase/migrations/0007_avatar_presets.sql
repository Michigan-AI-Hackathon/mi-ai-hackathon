-- Avatar presets are now named by role ('preset-engineer', 'preset-business', ...).
alter table public.profiles drop constraint avatar_url_format;
alter table public.profiles add constraint avatar_url_format
  check (avatar_url is null or avatar_url ~ '^preset-[a-z0-9]+$' or avatar_url ~ '^https://');
