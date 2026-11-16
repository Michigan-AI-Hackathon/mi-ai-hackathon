// What a student pays after their school's sponsorship. Pure functions, no imports, so they can be unit tested.
// The percent itself always comes from the database (my_sponsorship); this only turns it into dollars.

// Stripe refuses charges under 50 cents. A partly sponsored ticket never drops below this: the student pays the
// minimum and the sponsor covers the rest. Only a 100% sponsor makes it free.
export const STRIPE_MIN_CENTS = 50;

export type Quote = { baseCents: number; subsidyPct: number; subsidyCents: number; dueCents: number };

export function priceFor(baseCents: number, subsidyPct: number): Quote {
  const base = Math.max(0, Math.round(baseCents));
  const pct = Math.min(100, Math.max(0, Math.round(subsidyPct) || 0));
  let due = base - Math.round((base * pct) / 100);
  if (pct < 100 && due > 0 && due < STRIPE_MIN_CENTS) due = Math.min(base, STRIPE_MIN_CENTS);
  return { baseCents: base, subsidyPct: pct, subsidyCents: base - due, dueCents: due };
}

export function money(cents: number) {
  const d = cents / 100;
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`;
}

// Shape returned by the my_sponsorship() database function.
export type Sponsorship = { school_id?: number; tier?: string; label?: string; subsidy_pct: number; seats_left?: number | null };
