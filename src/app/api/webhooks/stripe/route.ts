import type Stripe from "stripe";
import { stripeClient } from "@/lib/stripe";
import { shopId } from "@/lib/config";
import { fulfillSession } from "@/lib/fulfillment";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.GP_STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.GP_STRIPE_SECRET_KEY) return Response.json({ error: "Webhook unavailable." }, { status: 503 });
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    return Response.json({ received: true });
  }
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.metadata?.shop !== shopId() || session.payment_status !== "paid") return Response.json({ received: true });
  try {
    await fulfillSession(session);
    return Response.json({ received: true });
  } catch {
    console.error("[stripe webhook] Order processing incomplete; retry required.", event.id);
    // A non-2xx response lets Stripe retry database or email failures.
    return Response.json({ error: "Please retry delivery." }, { status: 500 });
  }
}
