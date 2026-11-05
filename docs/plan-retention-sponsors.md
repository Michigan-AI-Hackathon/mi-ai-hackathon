# Plan: retention emails, self-join, sponsor tiers

No email domain and no final pricing yet, so everything below is config-driven and off by default.
Migrations 0011 (teams) and 0012 (bio limit) are taken, so these start at 0013.

## Phase 0: foundation
- `src/lib/email.ts`: one `deliver()` wrapper. `EMAIL_MODE=off` (default) skips, `log` prints recipient and subject only, `live` calls Resend. `live` requires `RESEND_API_KEY` and a non-`resend.dev` `EMAIL_FROM`, otherwise it falls back to `log`.
- `src/lib/config.ts`: replace the hard-coded `feeCents` with `BASE_FEE_CENTS` (env, placeholder 2000) and a pure `priceFor({baseCents, subsidyPct, earlyBird})`.
- Extract the cron bearer check from `api/cron/unread/route.ts` into `src/lib/cron-auth.ts`.
- Add `EMAIL_MODE`, `RETENTION_ENABLED`, `RETENTION_INACTIVE_WEEKS`, `RETENTION_NEVER_STARTED_WEEKS`, `RETENTION_MAX_PER_RUN` and `BASE_FEE_CENTS` to `.env.example`.

## Phase 1: sponsor tiers (migration 0014)
- `schools.sponsor_tier smallint default 1` (1, 2 or 3). New table `pricing_tiers(tier, label, subsidy_pct)` seeded 0 / 50 / 100. `app_settings.base_fee_cents` (nullable).
- Sponsor name and notes go in an admin-only `school_sponsors` table. `schools` is readable by students.
- `payments` gets `base_cents`, `subsidy_pct`, `school_id`, `tier`.
- `src/lib/pricing.ts` with `quoteFor(userId)`, always computed server-side. No school or unmapped school means T1. Handle Stripe's minimum charge and rounding.
- `startCheckout`:
  - Due amount above 0: reduce the Stripe `unit_amount`. Do not use a Stripe coupon.
  - Due amount of 0: call a new RPC `claim_sponsored_registration()` that re-derives the quote, sets `paid_at` and inserts a `payments` row with 0 cents. It is modelled on `admin_comp_student` and is idempotent.
- Dashboard shows the personal quote ("Your school covers 50%. You pay $Y") and the button reads "Claim your free spot" when due is 0. The landing page shows only the base price plus "Many schools sponsor".

## Phase 2: sponsor admin
- `admin/schools` page: tier selector, sponsor name, student / paid / comped counts.
- Audited RPC `admin_set_school_sponsor`, plus audited editing of tier percentages and the base fee.
- Report: registered / paid / comped, revenue, and subsidy owed (`sum(base_cents - amount_cents)`), with CSV export.
- Warn that changing a tier does not affect students who have already paid.

## Phase 3: reminder emails (migration 0013)
- Tracking: `profiles.last_seen_at` and `first_seen_at`, updated through a throttled `touch_seen()` RPC (at most hourly). Activity = greatest of `last_seen_at`, `auth.users.last_sign_in_at` and `created_at`. Add the new columns to `protect_profile_columns`, copying the 0008 body.
- Reminder state: `email_optout`, `inactive_reminder_sent_at`, `never_started_reminder_sent_at` and `optout_token`. `touch_seen()` clears the sent-at columns when the user returns.
- Service-role RPCs: `inactive_users_for_reminder(10)`, `never_started_users_for_reminder(2)`, `mark_reminder_sent`.
- New daily route `api/cron/retention`, scheduled through pg_cron like migration 0003.
  - It does nothing unless `RETENTION_ENABLED=true`.
  - `?dry=1` returns counts only.
  - Per-run cap.
  - Send first, then mark.
  - Seed or cap the backlog for existing users.
- Templates `sendInactiveReminder` and `sendNeverStartedReminder`, each with an unsubscribe link and a `List-Unsubscribe` header.
- `/unsubscribe` page that confirms with a POST (email scanners prefetch GET links) and is allowed through the middleware while logged out.

## Phase 4: self-select team (same migration as phase 3 or 0015)
- Recommended rule: captain turns on `teams.open_join`. A student with no team who is paid and has been inactive for 14 days can join an open team that has spots directly, with no invite.
- New RPC `self_join_team(team)`:
  - Checks `require_ready_student`, eligibility, `open_join` and the lock state.
  - Runs `team_add_problem` (max 4, school-mix rules).
  - Locks the team row, adds the member to the team chat, cancels pending invites and posts a system message.
- UI: "Join now" on the Teams page, and a "Allow people to join directly" checkbox in `TeamForms`.

## Phase 5: admin visibility and tests
- Students page: "Last active" column, inactive filter, reminder badges, CSV columns.
- Overview counts, and an `inactive` broadcast audience.
- Cases in `supabase/tests/rules.test.mjs` for `claim_sponsored_registration` and `self_join_team`.
- Switch `EMAIL_MODE=live` only once a sending domain is verified.

## Open questions
1. What counts as "never accessed": account created but not onboarded, or magic link requested but never clicked? The second is invisible in `auth.users`.
2. Is the 14-day self-join window measured from last sign-in, last team activity or onboarding? Does it apply only to `open_join` teams?
3. Should self-join be allowed for unpaid students? (The plan assumes no.) Do the school-mix rules still apply? (The plan assumes yes.)
4. Does opt-out also cover the unread digest and event announcements?
5. Does a subsidy stack with promo codes and early-bird pricing?
6. Who is the sponsor of record, and is the sponsor name shown to students? How do sponsors get invoiced, and is there a per-student cap?
7. Which sending domain and timezone should the daily job use?

## Non-code: pilot test (4-5 users)
- Recruit: one student per tier (T1, T2, T3, using test tiers), one non-technical person, one on a phone. Use Stripe test mode and `EMAIL_MODE=log`.
- Script, about 20 minutes each: read the landing page and guess the price, sign up and complete the profile, pay or claim the sponsored spot, find a team (invite, request, self-join), use the unsubscribe link, return after a simulated absence.
- Watch for: hesitation, whether the subsidy message is understood, whether the price shown matches the amount charged, whether a free spot feels like a bug, mobile layout, and what they say about price.
- Check on our side: webhook delivery, `payments` row contents, `paid_at` set once, audit log, no emails sent outside live mode.

## Non-code: pricing comparison (Ohio State and others)
For each event, record the price (early and late), whether it is refundable, who covers the cost, what is included, size and eligibility, and sponsor packages. Cite the source URL and date, and mark anything unpublished as "not published". Also gather our own cost per attendee and the sponsorship committed so far. Don't set `BASE_FEE_CENTS` or the tier percentages until this is done and organizers approve.
