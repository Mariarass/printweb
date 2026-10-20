const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load.cjs");

function harness() {
  let row = null, inserts = 0, sends = 0, reads = 0, rejectEmail = false;
  const db = { from: () => {
    let patch = null;
    const conditions = [];
    const execute = () => {
      if (row && conditions.every(([key, value]) => row[key] === value) && patch) Object.assign(row, patch);
      return { data: row ? structuredClone(row) : null, error: null };
    };
    const query = {
      select: () => query, eq: (key, value) => { conditions.push([key, value]); return query; },
      or: () => query,
      update: (value) => { patch = value; return query; },
      maybeSingle: async () => execute(), single: async () => execute(),
      then: (resolve, reject) => Promise.resolve(execute()).then(resolve, reject),
      upsert: async (value) => {
        if (!row) { inserts++; row = { ...value, customer_email_sent: false, owner_email_sent: false }; }
        return { error: null };
      },
    };
    return query;
  } };
  Object.assign(process.env, {
    GP_RESEND_API_KEY: "re_fake", GP_RESEND_FROM: "test@example.com",
    GP_CONTACT_EMAIL: "owner@example.com", GP_ORDER_NOTIFY_EMAIL: "owner@example.com",
  });
  const module = load("src/lib/fulfillment.ts", {
    "./config": { shopId: () => "girl-prints" },
    "./db": { database: () => db },
    "./stripe": { stripeClient: () => ({ checkout: { sessions: { listLineItems: async () => {
      reads++;
      return { has_more: false, data: [{
        quantity: 2, description: "Angel", price: { unit_amount: 1800,
          product: { name: "Angel", metadata: { variantId: "angel-small", size: "8 × 10", title: "Angel" } } },
      }] };
    } } } }) },
    resend: { Resend: class { emails = { send: async () => { sends++; return rejectEmail ? { error: {} } : { error: null, data: { id: "test" } }; } }; } },
  });
  const session = {
    id: "cs_test_order", mode: "payment", metadata: { shop: "girl-prints" }, payment_status: "paid", currency: "usd",
    amount_subtotal: 3600, amount_total: 3900, total_details: { amount_shipping: 0, amount_tax: 300, amount_discount: 0 },
    customer_details: { email: "customer@example.com", name: "Test Customer" },
    collected_information: { shipping_details: { name: "Test", address: { country: "US" } } },
  };
  return { ...module, session, stats: () => ({ inserts, sends, reads, row }), failEmail: (value) => { rejectEmail = value; } };
}

test("replayed paid sessions save one order and send each confirmation once", async () => {
  const h = harness();
  const first = await h.fulfillSession(h.session);
  const second = await h.fulfillSession(h.session);
  assert.equal(first.reference, second.reference);
  assert.equal(first.paid, true);
  const { inserts, sends, reads, row } = h.stats();
  assert.equal(inserts, 1);
  assert.equal(sends, 2);
  assert.equal(reads, 1);
  assert.equal(row.total_cents, 3900);
  assert.equal(row.lines[0].unitAmount, 1800);
});

test("mismatched totals and unpaid sessions cannot save a paid order", async () => {
  const h = harness();
  assert.deepEqual(await h.fulfillSession({ ...h.session, payment_status: "unpaid" }), { paid: false, saved: false, reference: null });
  await assert.rejects(() => h.fulfillSession({ ...h.session, amount_total: 1 }));
  assert.equal(h.stats().inserts, 0);
  assert.equal(h.stats().sends, 0);
});

test("email outage preserves paid order and a retry completes unsent emails", async () => {
  const h = harness();
  h.failEmail(true);
  await assert.rejects(() => h.fulfillSession(h.session));
  assert.equal(h.stats().inserts, 1);
  assert.equal(h.stats().row.status, "paid");
  assert.equal(h.stats().row.customer_email_sent, false);
  assert.equal(h.stats().row.email_lease, null);
  h.failEmail(false);
  const result = await h.fulfillSession(h.session);
  assert.equal(result.saved, true);
  assert.equal(h.stats().inserts, 1);
  assert.equal(h.stats().row.customer_email_sent, true);
  assert.equal(h.stats().row.owner_email_sent, true);
});
