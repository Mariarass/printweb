export const shopId = () => process.env.GP_SHOP_ID?.trim() || "girl-prints";
export const demoMode = () => process.env.GP_DEMO_MODE !== "false";
export const emailReady = () => Boolean(
  process.env.GP_RESEND_API_KEY && process.env.GP_RESEND_FROM &&
  process.env.GP_CONTACT_EMAIL && process.env.GP_ORDER_NOTIFY_EMAIL,
);
export const dbReady = () => Boolean(process.env.GP_SUPABASE_URL && process.env.GP_SUPABASE_SERVICE_ROLE_KEY);
export const checkoutReady = () => !demoMode() && process.env.GP_CHECKOUT_ENABLED === "true" &&
  Boolean(process.env.GP_STRIPE_SECRET_KEY && process.env.GP_STRIPE_WEBHOOK_SECRET &&
    process.env.GP_SITE_URL && dbReady() && emailReady());

// Never trust a request's Host header to construct payment redirects.
export function siteOrigin() {
  const url = new URL(process.env.GP_SITE_URL || "http://localhost:3001");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("GP_SITE_URL must use HTTPS outside localhost.");
  }
  return url.origin;
}
