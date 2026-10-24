import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe calls this after a payment or refund. It is the ONLY thing that marks
// someone as paid, so closing the browser after paying can't lose a payment.
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  const db = createAdminClient();

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as Stripe.Checkout.Session;
    const userId = s.metadata?.user_id ?? s.client_reference_id;
    if (userId && s.payment_status === "paid") {
      const { error } = await db.from("payments").upsert({
        user_id: userId,
        stripe_session_id: s.id,
        payment_intent: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id,
        amount_cents: s.amount_total ?? 0,
      }, { onConflict: "stripe_session_id", ignoreDuplicates: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 }); // Stripe retries
      await db.from("profiles").update({ paid_at: new Date().toISOString() }).eq("id", userId).is("paid_at", null);
    }
  }

  if (event.type === "charge.refunded") {
    const c = event.data.object as Stripe.Charge;
    const pi = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id;
    if (pi && c.refunded) {
      await db.from("payments").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("payment_intent", pi);
    }
  }
  return NextResponse.json({ received: true });
}
