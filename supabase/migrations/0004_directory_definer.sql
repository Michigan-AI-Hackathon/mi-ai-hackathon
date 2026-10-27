-- student_directory must run as its owner (not the caller): profiles RLS only lets a
-- student read their own row, and this view is the safe, column-limited way to see others.
-- Some projects end up with security_invoker=on, which makes everyone see only themselves.
alter view public.student_directory set (security_invoker = off);
