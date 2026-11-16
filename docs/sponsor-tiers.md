# School sponsorship (tiers)

A school, or a company paying on its behalf, can cover part or all of its students' tickets.

## How it works
- **Tiers** are rows in `pricing_tiers`: a code, a name and the % of the ticket the sponsor covers. Seeded A = 100% (free), B = 50%, C = 0%. Edit or add tiers on `/admin/schools`.
- **Schools** are mapped to a tier on `/admin/schools` (migration 0019, table `school_sponsorship`). A school with no row pays full price.
- **The student's discount** is worked out in the database from the school on their verified profile (`my_sponsorship()`). The browser never sends a price or percent. Students can't read the tier tables.
- **Dashboard** shows the personal price ("Your school covers $10. You pay $10"). If the school covers 100%, the button is "Claim your free spot" and no Stripe checkout happens (`claim_sponsored_registration`, server-only).
- **Part-sponsored**: Stripe charges the reduced amount. The webhook saves base price, sponsor share, school and tier on the `payments` row.
- **Seat cap** (optional, "Tickets paid for"): once the school's paid-for tickets are used, later students pay full price. Refunded tickets free their seat. A half-sponsored ticket also uses a seat. For part-sponsored tickets the cap is checked when the quote is shown, so a few checkouts started at the same moment can go slightly over.
- **Invoicing**: `/admin/schools` shows what each school owes (`sum(subsidy_cents)` over paid, non-refunded tickets).

## Things to know
- Changing a tier or percent only affects students who haven't paid yet. Recorded payments keep what was charged.
- "Shared-email campuses too" (on by default) puts every school that shares an email domain on the same tier. Students at `umich.edu` and `ferris.edu` choose their own campus, so otherwise they could pick the cheapest one.
- A partly sponsored ticket never goes below Stripe's 50 cent minimum.
- Promo codes in Stripe still work on top of a sponsorship. Turn them off in `startCheckout` (`allow_promotion_codes`) if that isn't wanted.
- Organizer "Mark paid" on the check-in page still works for cash or scholarships; it records no sponsor.

## Tests
`node supabase/tests/sponsorship.test.mjs`
