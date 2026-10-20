const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load.cjs");

const request = (body) => new Request("http://localhost:3001/api/checkout", {
  method: "POST", headers: { "Content-Type": "application/json", origin: "http://localhost:3001" },
  body: JSON.stringify(body),
});
const line = { variantId: "angel-small", quantity: 2, expectedPriceCents: 1800 };
const attemptId = "12345678-1234-1234-1234-123456789abc";

test("cart rejects duplicates, fractions, negative quantities and excessive bags", () => {
  const { parseCart } = load("src/lib/validation.ts");
  for (const value of [null, {}, [], [line, line], [{ ...line, quantity: -1 }], [{ ...line, quantity: 1.5 }], [{ ...line, quantity: 11 }], [{ ...line, expectedPriceCents: 0 }], Array.from({ length: 21 }, (_, i) => ({ ...line, variantId: "p" + i }))]) {
    assert.throws(() => parseCart(value));
  }
  assert.deepEqual(parseCart([line]), [line]);
});

function checkoutMocks(overrides = {}) {
  const calls = [];
  return { calls, mocks: {
    "@/lib/config": { checkoutReady: () => true, shopId: () => "girl-prints", siteOrigin: () => "http://localhost:3001" },
    "@/lib/db": { database: () => ({ from: () => ({ select: () => ({ in: async () => ({
      data: [{ id: "angel-small", size: "8 × 10 in", price_cents: 1800, active: true, gp_products: { title: "Angel", active: true } }], error: null,
    }) }) }) }) },
    "@/lib/stripe": { stripeClient: () => ({ checkout: { sessions: { create: async (...args) => {
      calls.push(args); return { id: "cs_test_sample", url: "https://checkout.stripe.com/test" };
    } } } }) },
    ...overrides,
  } };
}

test("checkout uses trusted catalog prices and an idempotency key", async () => {
  const { mocks, calls } = checkoutMocks();
  const { POST } = load("src/app/api/checkout/route.ts", mocks);
  const body = { items: [{ ...line, priceCents: 1, title: "Spoofed" }], attemptId };
  const response = await POST(request(body));
  assert.equal(response.status, 200);
  assert.equal(calls[0][0].line_items[0].price_data.unit_amount, 1800);
  assert.equal(calls[0][0].line_items[0].price_data.product_data.name, "Angel · 8 × 10 in");
  assert.equal(calls[0][0].cancel_url, "http://localhost:3001/?cart=open&payment=cancelled");
  await POST(request(body));
  assert.equal(calls[0][1].idempotencyKey, calls[1][1].idempotencyKey);
});

test("stale prices, missing variants and demo IDs cannot create sessions", async () => {
  const { mocks, calls } = checkoutMocks();
  const { POST } = load("src/app/api/checkout/route.ts", mocks);
  assert.equal((await POST(request({ items: [{ ...line, expectedPriceCents: 100 }], attemptId }))).status, 409);
  assert.equal((await POST(request({ items: [{ ...line, variantId: "unknown" }], attemptId }))).status, 409);
  assert.equal((await POST(request({ items: [{ ...line, variantId: "demo-angel-small" }], attemptId }))).status, 400);
  assert.equal(calls.length, 0);
});

test("demo checkout is fail-closed before querying external services", async () => {
  const { mocks, calls } = checkoutMocks({ "@/lib/config": { checkoutReady: () => false } });
  const { POST } = load("src/app/api/checkout/route.ts", mocks);
  assert.equal((await POST(request({ items: [line], attemptId }))).status, 503);
  assert.equal(calls.length, 0);
});

test("HTTP guard rejects cross-origin and oversized requests", async () => {
  const { readJson } = load("src/lib/http.ts", { "./config": { siteOrigin: () => "http://localhost:3001" } });
  const foreign = new Request("http://localhost:3001/api/contact", {
    method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: "{}",
  });
  await assert.rejects(() => readJson(foreign));
  await assert.rejects(() => readJson(request({ message: "x".repeat(21000) })));
});

test("contact validation rejects header injection and escapes message HTML", () => {
  const { parseContact, escapeHtml } = load("src/lib/validation.ts");
  assert.throws(() => parseContact({ name: "Name\r\nBcc: other", email: "a@b.co", message: "Hello there" }));
  assert.equal(escapeHtml('<img src=x onerror="bad">'), "&lt;img src=x onerror=&quot;bad&quot;&gt;");
});

test("Resend error responses never report contact delivery success", async () => {
  Object.assign(process.env, { GP_RESEND_API_KEY: "re_test", GP_RESEND_FROM: "test@example.com", GP_CONTACT_EMAIL: "owner@example.com", GP_RATE_LIMIT_SECRET: "unit-test-only" });
  const { POST } = load("src/app/api/contact/route.ts", {
    "@/lib/config": { dbReady: () => true },
    "@/lib/http": { readJson: async () => ({ name: "Test", email: "test@example.com", message: "Test message" }) },
    "@/lib/db": { database: () => ({ rpc: async () => ({ data: true, error: null }) }) },
    resend: { Resend: class { emails = { send: async () => ({ data: null, error: { message: "Rejected" } }) }; } },
  });
  const response = await POST(request({}));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).ok, undefined);
});

test("webhooks verify real Stripe signatures and process delayed payments", async () => {
  const Stripe = require("stripe");
  const stripe = new Stripe("sk_test_not_a_real_key");
  const secret = "whsec_test_only";
  process.env.GP_STRIPE_WEBHOOK_SECRET = secret;
  process.env.GP_STRIPE_SECRET_KEY = "sk_test_not_a_real_key";
  let processed = 0;
  let failing = false;
  const { POST } = load("src/app/api/webhooks/stripe/route.ts", {
    "@/lib/stripe": { stripeClient: () => stripe },
    "@/lib/config": { shopId: () => "girl-prints" },
    "@/lib/fulfillment": { fulfillSession: async () => { processed++; if (failing) throw new Error("DB offline"); } },
  });
  const send = (type, payment_status, signatureValid = true) => {
    const payload = JSON.stringify({ id: "evt_test", type, data: { object: { metadata: { shop: "girl-prints" }, payment_status } } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    return POST(new Request("http://localhost:3001/api/webhooks/stripe", {
      method: "POST", headers: { "stripe-signature": signatureValid ? signature : "invalid" }, body: payload,
    }));
  };
  assert.equal((await send("checkout.session.completed", "paid", false)).status, 400);
  assert.equal((await send("checkout.session.completed", "unpaid")).status, 200);
  assert.equal(processed, 0);
  assert.equal((await send("checkout.session.async_payment_succeeded", "paid")).status, 200);
  assert.equal(processed, 1);
  failing = true;
  assert.equal((await send("checkout.session.completed", "paid")).status, 500);
});

test("payment success URL cannot claim payment; confirmed payments survive a DB outage", async () => {
  let paid = false;
  const { GET } = load("src/app/api/payment-status/route.ts", {
    "@/lib/stripe": { stripeClient: () => ({ checkout: { sessions: { retrieve: async () => ({ metadata: { shop: "girl-prints" }, payment_status: paid ? "paid" : "unpaid" }) } } }) },
    "@/lib/config": { shopId: () => "girl-prints" },
    "@/lib/fulfillment": { fulfillSession: async () => { throw new Error("DB unavailable"); } },
  });
  const req = new Request("http://localhost:3001/api/payment-status?session_id=cs_test_0123456789abcdef");
  assert.deepEqual(await (await GET(req)).json(), { paid: false, saved: false });
  paid = true;
  assert.deepEqual(await (await GET(req)).json(), { paid: true, saved: false });
});
