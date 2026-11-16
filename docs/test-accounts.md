# Test accounts for the team

Use a **local or staging** Supabase project for this, not the live one. Anyone who can reach the login page of a
site with these turned on can sign in as an organizer.

## 1. Load the demo data

```
SUPABASE_URL=<project url> SUPABASE_SERVICE_KEY=<service role key> DEMO_PASSWORD=<pick one, 6+ chars> \
  node scripts/seed-demo.mjs
```

Safe to run again (existing accounts are skipped). It refuses to run against the production project.
Node 20 needs `NODE_OPTIONS=--experimental-websocket`.

## 2. Show the test accounts on the sign-in page

Set these on the staging site (and rebuild, since `NEXT_PUBLIC_` values are baked in at build time):

```
NEXT_PUBLIC_ENABLE_TEST_LOGIN=true
NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true
NEXT_PUBLIC_DEMO_PASSWORD=<the same password>
```

`/login` then lists the accounts below. Tap one, then "Sign in". Share the password with the team in chat, not in the repo.

## What's in the data

| Account | What it shows |
| --- | --- |
| `organizer@umich.edu`, `organizer2@msu.edu` | Organizers: `/admin`, banners, students, matching |
| `ns.ava@umich.edu` (leader), `ns.ben@msu.edu`, `ns.cam@wayne.edu`, `ns.dee@gvsu.edu` | Team Northstar: 4 of 4 and locked in |
| `wh.eli@umich.edu` (leader) and 3 others | Wolverine Health: full, not yet locked (leader can lock) |
| `bh.ivy@msu.edu` (leader), `bh.jay@umich.edu`, `bh.kai@emich.edu` | Blue Heron: 3 of 4 |
| `mr.lena@umich.edu`, `mr.milo@kettering.edu` | Maize Rush: 2 of 4 |
| `sl.nora@msu.edu` | Spartan Labs: 1 of 4 |
| `solo.*@...` | Paid, no team (most asked to be placed; one is picking their own) |
| `unpaid.*@...` | Finished profile, not paid (shows the pay / claim step) |
| `unfinished.*@...` | Signed up, profile unfinished |
| `newstudent@umich.edu` | Signed in, no profile: walks through onboarding |

Last-active times are spread from "just now" to three weeks ago so the organizer's "Inactive 7+ days" filter has something to show.

## Before launch

Remove the three env vars above from the live site and make sure no `organizer@…` or other test accounts exist in the live project.
