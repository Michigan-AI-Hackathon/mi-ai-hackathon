# Michigan AI Hackathon: team-matching site

Next.js 15 + Supabase + Stripe + Resend, hosted on Vercel.
Students sign up with a Michigan school email, build a profile, pay a $20 non-refundable registration fee,
find teammates, form a team that follows the school-mix rules, and message each other.

## What's built

| Area | Where | Notes |
|---|---|---|
| Landing page with countdown | `src/app/page.tsx` | Event date/place in `src/lib/config.ts` |
| Sign-in with a 6-digit email code, Michigan emails only | `src/app/login` | Blocked twice: the page checks first, and the database rejects any non-Michigan sign-up |
| Profile setup (year is private) | `src/app/onboarding` | Multi-campus emails (umich.edu) pick their campus |
| $20 registration fee via Stripe Checkout (price in `src/lib/config.ts`) | `startCheckout` in `src/app/actions.ts`, webhook in `src/app/api/stripe/webhook` | Only the webhook marks someone paid |
| Find teammates (search + filters) | `src/app/(app)/people` | Only finished, paid profiles appear |
| Open teams, ask to join | `src/app/(app)/teams` | |
| My team: 4 spots, invites, requests, lock in, leave | `src/app/(app)/team` | |
| Invites (expire after 48 hrs) | `src/app/(app)/invites` | Hours set in `app_settings` |
| Messages: team chat + 1:1, live | `src/app/(app)/messages` | Supabase Realtime |
| Email when a message sits unread 15 min | `src/app/api/cron/unread` + `supabase/migrations/0003_cron.sql` | Once per batch of messages, not repeatedly |
| Design system page | `/design` | See "Changing the design" |

## The team rules (all enforced in the database)

- At most 4 people
- At most 2 from the same school
- A team needs all 4 people to lock in, from at least 3 schools
- A team can have only as many open invites as it has open spots
- Everyone must have paid before the team can lock in
- Locked teams can't add or lose members

They live in `supabase/migrations/0001_init.sql` and `0005_team_rules_avatars.sql` (`team_add_problem`, `team_lock_problem`, `send_invite`), so no page bug can break them.
Run the tests any time: `node supabase/tests/rules.test.mjs` (54 checks, runs in memory, no setup).

**UM campuses:** Ann Arbor, Dearborn and Flint share `umich.edu` but count as THREE separate schools (migration 0005).

**Pricing:** set `EARLY_BIRD` in `src/lib/config.ts` for an early-bird price with an end date. Checkout also accepts coupon codes; create them in the Stripe dashboard (Product catalog > Coupons > add a promotion code).

**Avatars:** optional. Four presets in `public/avatars`, or an upload to the `avatars` storage bucket (migration 0006).

## Organizers

Organizers get a separate area at `/admin` (students who visit it get a 404).
Make someone an organizer in the Supabase SQL editor. This is the ONLY way; no page can do it:

`update public.profiles set is_admin = true where email = 'organizer@umich.edu';`

What they can do: see live statistics, search and export students (CSV), move students between teams, lock or unlock
and dissolve teams, mark a student paid (cash or scholarship), check people in, fill teams for students who have none
(they review the suggestion first), and email students (everyone, unpaid, no team, and more).

## Security

- **Every organizer action is a database function** that checks `is_admin()` itself, applies the same team rules as for students
  (an organizer can ignore the school mix, never the 4-person cap), and writes a row to `audit_log`.
  The pages only call those functions. The audit log can't be edited from the site.
- Students can't change `is_admin`, `paid_at`, `email` or `checked_in_at` on their own profile (database trigger).
- `/admin` pages and actions are blocked for non-organizers twice: in the app (404) and in the database.
- CSV export neutralizes spreadsheet formulas, and every export is logged. Organizer pages are never cached.
- Announcements are escaped (no HTML injection), limited to 3 per 10 minutes, and logged.
- Profile pictures can only be a preset or a file in our own storage bucket.
- Security headers on every response (no framing, no MIME sniffing, HSTS, locked-down browser features).
- The cron endpoint refuses everything unless `CRON_SECRET` is set and matches.
- Run `node supabase/tests/rules.test.mjs` after any database change. It checks that students cannot use organizer functions.
- **Updating safely:** run `npm audit` monthly. Today's only high finding is PostCSS bundled inside Next 15 (build time only);
  the fix is the Next 16 upgrade, which should be done on a branch with the tests and a preview deploy.

## Setup (about an hour, all on the aihackathonumich@gmail.com accounts)

1. **Supabase** (supabase.com, sign in with the shared Google account)
   - New project. Region: East US.
   - SQL Editor: run `supabase/migrations/0001_init.sql`, then `0002_schools.sql`.
   - Authentication > Sign In / Providers > Email: make sure it is on.
   - Authentication > Emails > "Magic Link" template: include the code, e.g. `Your sign-in code is {{ .Token }}`.
   - Authentication > Emails > SMTP: connect Resend (step 3). Supabase's built-in email only reaches your own team, so real students won't get codes without this.
   - Authentication > URL Configuration: Site URL = your Vercel URL.
2. **Stripe** (stripe.com): stay in **test mode** until launch.
   - Developers > API keys: copy the secret key.
   - Developers > Webhooks > Add endpoint: `https://YOUR-SITE/api/stripe/webhook`, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`. Copy the signing secret.
   - The fee is non-refundable. For a one-off exception, refund it in Stripe Dashboard > Payments; the site records it automatically.
3. **Resend** (resend.com): verify the domain you'll send from (needs a domain, e.g. the site's), create an API key, and use its SMTP settings in Supabase step 1.
4. **Vercel** (vercel.com): import the GitHub repo, add every variable from `.env.example`, deploy.
5. **Unread-message emails:** in Supabase, Database > Extensions: enable `pg_cron` and `pg_net`. Edit the URL and secret in `0003_cron.sql`, run it.
6. Make yourself an admin: `update public.profiles set is_admin = true where email = 'you@umich.edu';`

Local dev: `cp .env.example .env.local`, fill it in, `npm install`, `npm run dev`.
Test Stripe webhooks locally with the Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Changing the design

Everything visual comes from **one file: `src/styles/theme.css`.** Colors, fonts, corner radius, text sizes.
Change a value there and every page updates. Open `/design` to see all colors, type and components on one page.

- Class names in the pages describe a **role**, not a color (`bg-primary`, `text-muted`, `border-line`),
  so a new palette never means editing pages.
- Buttons, inputs, cards and tags are defined once at the bottom of `src/app/globals.css`
  (`btn-primary`, `input`, `panel`, `chip`...). Change their shape or spacing there.
- The variable names in `theme.css` match how a designer would name Figma variables
  (`color/brand-primary` = `--color-brand-primary`). Ask the designer to use the same names and the handoff is copy-paste.
- New fonts: `npm install @fontsource-variable/<font>`, import it in `src/app/layout.tsx`, update the two font lines in `theme.css`.
- Layout changes from new wireframes happen in the page files; each page is one file under `src/app`.

## Not built yet (see PLAN.md)

Admin dashboard, check-in, automatic matching for solo students, ambassador accounts.
