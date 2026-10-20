import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { Resend } from "resend";
import { database } from "./db";
import { shopId } from "./config";
import { stripeClient } from "./stripe";
import { escapeHtml } from "./validation";
import { money, type OrderLine } from "./types";

type StoredOrder = {
  session_id: string; reference: string; lines: OrderLine[]; total_cents: number;
  subtotal_cents: number; tax_cents: number; shipping_cents: number;
  customer_email: string; customer_name: string | null;
  shipping: NonNullable<Stripe.Checkout.Session["collected_information"]>["shipping_details"] | null;
  customer_email_sent: boolean; owner_email_sent: boolean;
};

export async function fulfillSession(session: Stripe.Checkout.Session) {
  if (session.metadata?.shop !== shopId() || session.mode !== "payment") throw new Error("Foreign session.");
  if (session.payment_status !== "paid") return { paid: false, saved: false, reference: null };
  const db = database();
  const { data: existing, error: lookupError } = await db.from("gp_orders").select("*").eq("session_id", session.id).maybeSingle();
  if (lookupError) throw lookupError;
  let order = existing as StoredOrder | null;
  if (!order) {
    const stripe = stripeClient();
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100, expand: ["data.price.product"] });
    if (items.has_more || !items.data.length || session.currency !== "usd") throw new Error("Invalid payment lines.");
    const lines = items.data.map((item): OrderLine => {
      const product = item.price?.product as Stripe.Product | undefined;
      if (!product || product.deleted || !product.metadata.variantId || !item.quantity || !item.price?.unit_amount) {
        throw new Error("Invalid payment snapshot.");
      }
      return {
        variantId: product.metadata.variantId, title: product.metadata.title || item.description || product.name,
        size: product.metadata.size || "", quantity: item.quantity, unitAmount: item.price.unit_amount,
      };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitAmount, 0);
    const tax = session.total_details?.amount_tax ?? 0;
    const shipping = session.total_details?.amount_shipping ?? 0;
    if (subtotal !== session.amount_subtotal || subtotal + tax + shipping !== session.amount_total ||
      (session.total_details?.amount_discount ?? 0) !== 0 || !session.customer_details?.email) {
      throw new Error("Payment total or customer could not be verified.");
    }
    const reference = `GP-${randomUUID().slice(0, 8).toUpperCase()}`;
    const { error } = await db.from("gp_orders").upsert({
      session_id: session.id, reference, status: "paid", currency: "usd", lines,
      subtotal_cents: subtotal, tax_cents: tax, shipping_cents: shipping, total_cents: session.amount_total,
      customer_email: session.customer_details.email, customer_name: session.customer_details.name,
      shipping: session.collected_information?.shipping_details ?? null,
      payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
    }, { onConflict: "session_id", ignoreDuplicates: true });
    if (error) throw error;
    const stored = await db.from("gp_orders").select("*").eq("session_id", session.id).single();
    if (stored.error) throw stored.error;
    order = stored.data as StoredOrder;
  }
  await sendOrderEmails(order);
  return { paid: true, saved: true, reference: order.reference };
}

async function sendOrderEmails(order: StoredOrder) {
  if (order.customer_email_sent && order.owner_email_sent) return;
  const db = database();
  const lease = randomUUID();
  const now = new Date();
  const { data: locked, error: lockError } = await db.from("gp_orders")
    .update({ email_lease: lease, email_lease_until: new Date(now.getTime() + 300000).toISOString() })
    .eq("session_id", order.session_id)
    .or(`email_lease_until.is.null,email_lease_until.lt.${now.toISOString()}`)
    .select("*").maybeSingle();
  if (lockError) throw lockError;
  // A concurrent webhook or return request owns delivery; ask Stripe to retry.
  if (!locked) throw new Error("Order email delivery is in progress.");
  const current = locked as StoredOrder;
  try {
    const apiKey = process.env.GP_RESEND_API_KEY;
    const from = process.env.GP_RESEND_FROM;
    const contact = process.env.GP_CONTACT_EMAIL;
    const owner = process.env.GP_ORDER_NOTIFY_EMAIL;
    if (!apiKey || !from || !contact || !owner) throw new Error("New email account is not configured.");
    const resend = new Resend(apiKey);
    const e = escapeHtml;
    const linesHtml = current.lines.map((l) =>
      `<tr><td style="padding:12px 0;border-bottom:1px solid #c9d6e2">${e(l.title)}<br><small>${e(l.size)} × ${l.quantity}</small></td><td style="text-align:right">${money(l.unitAmount * l.quantity)}</td></tr>`,
    ).join("");
    const totals = `<p>Prints: ${money(current.subtotal_cents)}<br>Shipping: ${money(current.shipping_cents)}<br>Tax: ${money(current.tax_cents)}</p><p><strong>Total: ${money(current.total_cents)}</strong></p>`;
    const body = (heading: string, text: string) => `<div style="background:#f2f5fa;padding:32px;font-family:Arial,sans-serif;color:#0b0c10;max-width:560px;margin:auto"><p>GIRL PRINTS /</p><h1>${heading}</h1><p>${text}</p><p>Order ${e(current.reference)}</p><table style="width:100%">${linesHtml}</table>${totals}<p>Questions? Reply to this email.</p></div>`;
    if (!current.customer_email_sent) {
      const result = await resend.emails.send({
        from, to: current.customer_email, replyTo: contact,
        subject: `Your print order is confirmed · ${current.reference}`,
        html: body("Your order is confirmed.", "Your payment is confirmed and we’ve received your order."),
      }, { idempotencyKey: `${shopId()}/${current.session_id}/customer` });
      if (result.error) throw new Error("Customer email was not accepted.");
      const saved = await db.from("gp_orders").update({ customer_email_sent: true }).eq("session_id", current.session_id).eq("email_lease", lease);
      if (saved.error) throw saved.error;
    }
    if (!current.owner_email_sent) {
      const address = current.shipping?.address;
      const shipping = [current.shipping?.name, address?.line1, address?.line2, address?.city, address?.state, address?.postal_code, address?.country].filter(Boolean).map((s) => e(String(s))).join("<br>");
      const result = await resend.emails.send({
        from, to: owner, replyTo: current.customer_email,
        subject: `New paid order · ${current.reference}`,
        html: body("A new print order!", `${e(current.customer_name ?? "")}<br>${e(current.customer_email)}<br><br>Ship to:<br>${shipping || "Check the shipping address in Stripe."}`),
      }, { idempotencyKey: `${shopId()}/${current.session_id}/owner` });
      if (result.error) throw new Error("Owner email was not accepted.");
      const saved = await db.from("gp_orders").update({ owner_email_sent: true }).eq("session_id", current.session_id).eq("email_lease", lease);
      if (saved.error) throw saved.error;
    }
  } finally {
    await db.from("gp_orders").update({ email_lease: null, email_lease_until: null }).eq("session_id", order.session_id).eq("email_lease", lease);
  }
}
