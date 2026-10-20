import { createHash } from "node:crypto";
import { checkoutReady, shopId, siteOrigin } from "@/lib/config";
import { database } from "@/lib/db";
import { readJson } from "@/lib/http";
import { parseCart } from "@/lib/validation";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!checkoutReady()) return Response.json({ error: "The shop is getting ready. Checkout isn’t open yet." }, { status: 503 });
  let input: { items?: unknown; attemptId?: unknown };
  let cart;
  try {
    input = await readJson(request) as typeof input;
    cart = parseCart(input?.items);
    if (cart.some((line) => line.variantId.startsWith("demo-"))) throw new Error("Sample prints can’t be purchased.");
    if (typeof input.attemptId !== "string" || !/^[0-9a-f-]{36}$/.test(input.attemptId)) throw new Error("Please reopen your bag and try again.");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid bag." }, { status: 400 });
  }
  try {
    const { data, error } = await database().from("gp_variants")
      .select("id,size,price_cents,active,gp_products!inner(title,active)")
      .in("id", cart.map((l) => l.variantId));
    if (error || !data) throw new Error("Catalog unavailable.");
    const lines = cart.map((line) => {
      const variant = data.find((v) => v.id === line.variantId);
      const product = variant?.gp_products as unknown as { title: string; active: boolean } | undefined;
      if (!variant?.active || !product?.active) throw new Error("A print is no longer available. Please refresh the shop.");
      if (variant.price_cents !== line.expectedPriceCents) throw new Error("A price has changed. Refresh the shop and review your bag.");
      return {
        quantity: line.quantity,
        price_data: {
          currency: "usd", unit_amount: variant.price_cents, tax_behavior: "exclusive" as const,
          product_data: {
            name: `${product.title} · ${variant.size}`,
            tax_code: "txcd_99999999",
            metadata: { variantId: variant.id, size: variant.size, title: product.title },
          },
        },
      };
    });
    const fingerprint = createHash("sha256").update(JSON.stringify(lines)).digest("hex").slice(0, 24);
    const origin = siteOrigin();
    const session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      metadata: { shop: shopId() },
      success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?cart=open&payment=cancelled`,
      billing_address_collection: "required",
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount", fixed_amount: { amount: 0, currency: "usd" },
          display_name: "Free US shipping", tax_behavior: "exclusive", tax_code: "txcd_92010001",
        },
      }],
      automatic_tax: { enabled: process.env.GP_STRIPE_AUTOMATIC_TAX !== "false" },
      line_items: lines,
    }, { idempotencyKey: `${shopId()}:${input.attemptId}:${fingerprint}` });
    if (!session.url) throw new Error("No checkout URL.");
    return Response.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safe = message.startsWith("A print") || message.startsWith("A price");
    console.error("[checkout] Session creation failed.");
    return Response.json({ error: safe ? message : "We couldn’t open checkout. Please try again in a moment." }, { status: safe ? 409 : 502 });
  }
}
