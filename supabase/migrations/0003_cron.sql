-- Runs the unread-message emails + invite expiry every 10 minutes.
-- BEFORE RUNNING: enable the pg_cron and pg_net extensions (Database > Extensions),
-- then replace YOUR-SITE and YOUR-CRON-SECRET below with your Vercel URL and the CRON_SECRET env var.
select cron.schedule(
  'unread-messages-and-invite-expiry',
  '*/10 * * * *',
  $$
  select net.http_get(
    url := 'https://YOUR-SITE.vercel.app/api/cron/unread',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR-CRON-SECRET')
  );
  $$
);
