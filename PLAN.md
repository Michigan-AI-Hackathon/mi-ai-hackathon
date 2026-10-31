# What's left, in order

Each step has a prompt you can paste into Claude Code from the repo folder.
Run `node supabase/tests/rules.test.mjs` after any database change.

## 1. Go live on test accounts (before the Nov 10 midpoint)
Follow README "Setup". Create 5 test students at different schools and walk through:
sign up, profile, pay with Stripe test card 4242 4242 4242 4242, invite, accept, message, lock in.

## 2. Organizer area (built, needs migration 0008 pushed)
`/admin`: overview statistics, student search with CSV export, team list with rule flags, day-of check-in,
automatic team filling (suggest, review, apply, email), announcements, and an audit log.
Make someone an organizer with SQL only (students can never grant it): see README "Organizers".
Remaining ideas: scan a QR code to check in, schedule announcements.

## 5. Lock-in deadline + reminders
Set `lock_deadline` in the `app_settings` table. Then:
> Email students without a team 7 days and 2 days before lock_deadline, and teams that aren't locked yet.

## 6. Before real students use it
- Turn OFF test mode: delete NEXT_PUBLIC_ENABLE_TEST_LOGIN in Vercel and turn "Confirm email" back ON in Supabase.
- Remove demo data (commands at the top of supabase/demo_data.sql) and any +test accounts.
- Switch Stripe to live keys (Phil confirmed Stripe).
- Buy a domain, verify it in Resend, set EMAIL_FROM.
- Confirm event date/place in src/lib/config.ts.
- Decide: UM campuses one school or three (README).
- Turn on Supabase Pro ($25/mo) so the project never pauses.
- Add the "non-refundable" line to the terms students agree to before paying.

## 7. When the designer's work arrives
Edit src/styles/theme.css and check /design. Then adjust page layouts to the wireframes, one page file at a time.
