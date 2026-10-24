import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe calls this after a payment or refund. It is the ONLY thing that marks
// someone as paid, so closing the browser after paying can't lose a payment.
// Accepts checkout, payment_intent and charge events, so it works whichever
// events the Stripe webhook destination is subscribed to.
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e) {
    console.error("Stripe webhook signature check failed:", (e as Error).message);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  const db = createAdminClient();

  async function markPaid(userId: string | null | undefined, paymentIntent: string | null | undefined, sessionId: string | null, amount: number) {
    if (!userId || !paymentIntent) return null;
    const { error } = await db.from("payments").upsert(
      { user_id: userId, payment_intent: paymentIntent, stripe_session_id: sessionId ?? paymentIntent, amount_cents: amount },
      { onConflict: "payment_intent", ignoreDuplicates: true },
    );
    if (error) return error.message;
    const { error: e2 } = await db.from("profiles").update({ paid_at: new Date().toISOString() }).eq("id", userId).is("paid_at", null);
    return e2?.message ?? null;
  }

  let failure: string | null = null;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.payment_status === "paid") {
        const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
        failure = await markPaid(s.metadata?.user_id ?? s.client_reference_id, pi, s.id, s.amount_total ?? 0);
      }
      break;
    }
    case "payment_intent.succeeded": {
      const p = event.data.object as Stripe.PaymentIntent;
      failure = await markPaid(p.metadata?.user_id, p.id, null, p.amount_received);
      break;
    }
    case "charge.succeeded":
    case "charge.updated": {
      const c = event.data.object as Stripe.Charge;
      if (c.paid && c.status === "succeeded") {
        const pi = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id;
        failure = await markPaid(c.metadata?.user_id, pi, null, c.amount_captured);
      }
      break;
    }
    case "charge.refunded": {
      const c = event.data.object as Stripe.Charge;
      const pi = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id;
      if (pi && c.refunded) {
        await db.from("payments").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("payment_intent", pi);
      }
      break;
    }
  }
  if (failure) {
    console.error("Stripe webhook could not record payment:", failure);
    return NextResponse.json({ error: failure }, { status: 500 }); // Stripe retries
  }
  return NextResponse.json({ received: true });
}
