import Stripe from "stripe";

// Same hosted Checkout integration as the source shop, with isolated credentials.
export function stripeClient() {
  const key = process.env.GP_STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("New Stripe account is not configured.");
  return new Stripe(key);
}
