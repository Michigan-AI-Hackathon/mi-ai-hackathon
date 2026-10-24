# What's left, in order

Each step has a prompt you can paste into Claude Code from the repo folder.
Run `node supabase/tests/rules.test.mjs` after any database change.

## 1. Go live on test accounts (before the Nov 10 midpoint)
Follow README "Setup". Create 5 test students at different schools and walk through:
sign up, profile, pay with Stripe test card 4242 4242 4242 4242, invite, accept, message, lock in.

## 2. Admin dashboard (Week 6 in the project plan)
> Add an /admin section only visible to profiles with is_admin = true. Pages: (1) students: search,
> filter by paid / on a team / no team, export CSV; (2) teams: list with member count, schools, locked status,
> and a flag for teams that break the rules; (3) unmatched students and incomplete teams for day-of matching.
> Admins can move a student between teams and unlock a team through new security-definer SQL functions that
> check public.is_admin(). Add tests to supabase/tests/rules.test.mjs.

## 3. Check-in at the event
> Add check-in to the admin section: search a student or scan a QR code from their dashboard and mark them
> checked in. Show checked-in counts by team so staff can spot no-shows and fill teams on the day.

## 4. Automatic matching for solo students
> Add an admin "Suggest teams" tool: take students with no team who are paid, group them into teams of 4
> using tracks and complementary skills, never breaking the school rules (use team_add_problem), show the
> suggestion for review, then create the teams on approval and email each member.

## 5. Lock-in deadline + reminders
Set `lock_deadline` in the `app_settings` table. Then:
> Email students without a team 7 days and 2 days before lock_deadline, and teams that aren't locked yet.

## 6. Before real students use it
- Switch Stripe to live keys (Phil confirmed Stripe).
- Buy a domain, verify it in Resend, set EMAIL_FROM.
- Confirm event date/place in src/lib/config.ts.
- Decide: UM campuses one school or three (README).
- Turn on Supabase Pro ($25/mo) so the project never pauses.
- Add the "non-refundable" line to the terms students agree to before paying.

## 7. When the designer's work arrives
Edit src/styles/theme.css and check /design. Then adjust page layouts to the wireframes, one page file at a time.
