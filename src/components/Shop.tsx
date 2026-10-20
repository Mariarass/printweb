"use client";

/* Local and merchant-controlled product URLs work without a remote image host allowlist. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { money, type CartLine, type Print } from "@/lib/types";
import { parseCart } from "@/lib/validation";
import Modal from "./Modal";
import ContactForm from "./ContactForm";
import PrintViewer from "./PrintViewer";

const CART_KEY = "girl-prints:bag:v1";
const PAYMENT_KEY = "girl-prints:checkout:";
type PaymentState = "checking" | "pending" | "syncing" | "paid" | "error";

function BagIcon() {
  return <svg width="19" height="21" viewBox="0 0 24 26" fill="none" aria-hidden="true"><path d="M5 8H19L21 23H3L5 8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8 9V6a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" /></svg>;
}

function PrintCard({ print, open }: { print: Print; open: (print: Print, variantId: string) => void }) {
  const variant = print.variants[0];
  return <article className={`print-card category-${print.category.toLowerCase()}`}>
    <button className="print-stage" onClick={() => open(print, variant.id)} aria-label={`View ${print.title}`} aria-haspopup="dialog"><img src={print.image} alt="" width={480} height={600} loading="lazy" /><span className="print-view-label">Take a closer look ↗</span></button>
    <div className="print-heading"><h3><button className="print-title" onClick={() => open(print, variant.id)} aria-haspopup="dialog">{print.title}</button></h3><span>{money(variant.priceCents)}</span></div>
  </article>;
}

export default function Shop({ prints, demo, unavailable, checkoutEnabled }: {
  prints: Print[]; demo: boolean; unavailable: boolean; checkoutEnabled: boolean;
}) {
  const [viewing, setViewing] = useState<{ id: string; variantId: string } | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [policy, setPolicy] = useState<"shipping" | "privacy" | null>(null);
  const [bagNotice, setBagNotice] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [pending, setPending] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentState, setPaymentState] = useState<PaymentState>("checking");
  const [paymentReference, setPaymentReference] = useState("");
  const [retry, setRetry] = useState(0);
  const attempt = useRef<string | null>(null);
  const checkoutInFlight = useRef(false);
  const clearedSession = useRef("");
  const variants = useMemo(() => new Map(prints.flatMap((p) => p.variants.map((v) => [v.id, { print: p, variant: v }] as const))), [prints]);
  const viewedPrint = prints.find((print) => print.id === viewing?.id);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      const saved = Array.isArray(raw) && raw.length === 0 ? [] : parseCart(raw);
      const valid = saved.filter((l) => variants.has(l.variantId));
      if (saved.length !== valid.length) setBagNotice("Some prints are no longer available and were removed from your bag.");
      setCart(valid.map((l) => ({ ...l, expectedPriceCents: variants.get(l.variantId)!.variant.priceCents })));
    } catch { setBagNotice("Your bag couldn’t be restored. You can start a new one."); }
    setHydrated(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get("cart") === "open") setCartOpen(true);
    if (params.get("payment") === "cancelled") setBagNotice("Checkout was cancelled. Your prints are still here.");
    if (params.get("payment") === "success" && params.get("session_id")) {
      setSessionId(params.get("session_id")!); setPaymentOpen(true);
    }
  }, [variants]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
    catch { setBagNotice("Your browser can’t save this bag. Keep this tab open while shopping."); }
  }, [cart, hydrated]);

  useEffect(() => {
    if (!sessionId || !paymentOpen || !hydrated) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    let checks = 0;
    async function check() {
      checks++;
      try {
        const response = await fetch(`/api/payment-status?session_id=${encodeURIComponent(sessionId)}`, { signal: controller.signal });
        const result = await response.json();
        if (stopped) return;
        if (!response.ok) throw new Error("Could not verify.");
        if (result.paid && result.saved) {
          setPaymentState("paid"); setPaymentReference(result.reference || "");
          if (clearedSession.current !== sessionId) {
            clearedSession.current = sessionId;
            try {
              const snapshot = localStorage.getItem(PAYMENT_KEY + sessionId);
              if (snapshot) {
                const purchased = parseCart(JSON.parse(snapshot));
                setCart((current) => current.map((l) => ({
                  ...l, quantity: Math.max(0, l.quantity - (purchased.find((p) => p.variantId === l.variantId)?.quantity ?? 0)),
                })).filter((l) => l.quantity > 0));
                localStorage.removeItem(PAYMENT_KEY + sessionId);
              }
            } catch { /* Payment is still confirmed if browser storage is unavailable. */ }
          }
          return;
        }
        setPaymentState(result.paid ? "syncing" : "pending");
        if (checks < 10) timer = setTimeout(check, 3000);
      } catch {
        if (!stopped) setPaymentState("error");
      }
    }
    void check();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [sessionId, paymentOpen, hydrated, retry]);

  const count = cart.reduce((n, l) => n + l.quantity, 0);
  const subtotal = cart.reduce((n, l) => n + (variants.get(l.variantId)?.variant.priceCents ?? 0) * l.quantity, 0);
  function add(print: Print, variantId: string) {
    const variant = print.variants.find((v) => v.id === variantId)!;
    setCart((current) => {
      const line = current.find((l) => l.variantId === variantId);
      if (line) return current.map((l) => l.variantId === variantId ? { ...l, quantity: Math.min(10, l.quantity + 1) } : l);
      if (current.length >= 20) return current;
      return [...current, { variantId, quantity: 1, expectedPriceCents: variant.priceCents }];
    });
    setCheckoutError(""); setBagNotice(""); setViewing(null); setCartOpen(true); attempt.current = null;
  }
  function quantity(variantId: string, value: number) {
    setCart((current) => current.map((l) => l.variantId === variantId ? { ...l, quantity: Math.min(10, value) } : l).filter((l) => l.quantity > 0));
    setCheckoutError(""); attempt.current = null;
  }
  async function checkout() {
    if (checkoutInFlight.current || !cart.length || !checkoutEnabled) return;
    checkoutInFlight.current = true; setPending(true); setCheckoutError("");
    attempt.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart, attemptId: attempt.current }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Checkout couldn’t open.");
      try { localStorage.setItem(PAYMENT_KEY + result.sessionId, JSON.stringify(cart)); } catch { /* Checkout remains usable without storage. */ }
      window.location.assign(result.url);
    } catch (error) { setCheckoutError(error instanceof Error ? error.message : "Please check your connection and try again."); }
    finally { checkoutInFlight.current = false; setPending(false); }
  }
  function closePayment() {
    setPaymentOpen(false);
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
  }
  function openContact() { setCartOpen(false); setPolicy(null); setContactOpen(true); }

  return <>
    <a className="skip-link" href="#prints">Skip to prints</a>
    <div className="announcement">YOUR SPACE. YOUR RULES. <span aria-hidden="true">✦</span> ART PRINTS WITH ATTITUDE.</div>
    <header className="header">
      <nav aria-label="Main navigation"><a href="#prints">Shop prints</a><button onClick={openContact}>Contact</button></nav>
      <a className="wordmark" href="/" aria-label="Girl Prints home">girl<span>prints</span><i aria-hidden="true">✦</i></a>
      <button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Open bag, ${count} items`}><BagIcon /><span>My bag</span><b>{count}</b></button>
    </header>
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-orbit" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> THE POSTER EDIT / VOL. 01</p>
          <h1 id="hero-title">WALLS <br />WITH<br /><em>ATTITUDE.</em></h1>
          <p className="hero-description">A little 2000s. A lot of personality.<br />Prints for a space that’s unapologetically yours.</p>
          <a className="primary hero-cta" href="#prints">SHOP THE PRINTS <span aria-hidden="true">↗</span></a>
          <p className="hero-note">TURN YOUR ROOM INTO YOUR MOODBOARD.</p>
        </div>
        <div className="hero-collage" aria-label="Chrome, blue and black graphic art prints">
          <span className="collage-coordinate">GP / IN FULL COLOUR</span>
          <div className="poster-orbit" aria-hidden="true" />
          <div className="hero-paper paper-kiss"><img src="/prints/kiss.svg" alt="Black and acid-yellow lips graphic print" width={480} height={600} /></div>
          <div className="hero-paper paper-angel"><img src="/prints/chrome-angel.svg" alt="Chrome angel wings on an electric blue art print" width={480} height={600} fetchPriority="high" /></div>
          <div className="hero-paper paper-butterfly"><img src="/prints/butterfly-2000.svg" alt="Silver butterfly graphic on a black poster" width={480} height={600} /></div>
          <span className="chrome-sparkle sparkle-one" aria-hidden="true">✦</span><span className="chrome-sparkle sparkle-two" aria-hidden="true">✦</span>
          <div className="edition-sticker">NO BORING<br /><strong>WALLS.</strong><span aria-hidden="true">↗</span></div>
          <span className="collage-caption">BIG MOOD. SMALL ROOM. NO PROBLEM.</span>
        </div>
        <div className="hero-bottom"><span>INDEPENDENT PRINT STUDIO</span><span>SCROLL TO FIND YOUR MOOD <b aria-hidden="true">↓</b></span></div>
      </section>
      <section className="catalog section-wrap" id="prints" aria-labelledby="prints-title">
        <div className="section-heading"><div><p className="eyebrow">PICK YOUR PERSONALITY</p><h2 id="prints-title">THE WALL LINEUP.</h2></div><p>Good taste.<br />Loud walls.</p></div>
        {demo && <p className="demo-note"><span>PREVIEW /</span> Sample artwork & prices. The real collection is coming soon.</p>}
        {unavailable ? <div className="empty-catalog"><h3>The prints are taking a little break.</h3><p>We couldn’t load the collection. Please try again soon.</p><button className="text-button" onClick={() => window.location.reload()}>Try again</button></div> :
          prints.length ? <div className="print-grid">{prints.map((p) => <PrintCard key={p.id} print={p} open={(print, variantId) => setViewing({ id: print.id, variantId })} />)}</div> :
          <div className="empty-catalog"><h3>A little something is on its way.</h3><p>New prints will appear here soon.</p></div>}
        <p className="catalog-footnote"><span aria-hidden="true">✦</span> Art prints only. Frames and styling aren’t included.</p>
      </section>
      <section className="manifesto">
        <div className="manifesto-graphic" aria-hidden="true"><span>✦</span><span className="manifesto-orbit" /></div>
        <div className="manifesto-copy"><p className="eyebrow">FOR THE GIRLS WITH A POINT OF VIEW.</p><h2>GOOD GIRLS.<br /><em>BOLD WALLS.</em></h2><p>Your playlists. Your outfits. Your walls.<br />Make it all feel like you.</p><a className="text-link" href="#prints">FIND YOUR MOOD ↗</a></div>
        <span className="manifesto-index">GIRL PRINTS / 001</span>
      </section>
      <section className="contact-strip section-wrap"><div><p className="eyebrow">THE DIRECT LINE</p><h2>LET’S TALK.</h2><p>Print questions. Order help. Whatever’s on your mind.</p></div><button className="outline-button" onClick={openContact}>GET IN TOUCH <span aria-hidden="true">↗</span></button></section>
    </main>
    <footer className="footer"><div className="footer-top"><a className="wordmark" href="/">girl<span>prints</span><i aria-hidden="true">✦</i></a><p>YOUR SPACE. YOUR RULES.</p><div><button onClick={() => setPolicy("shipping")}>Shipping & returns</button><button onClick={() => setPolicy("privacy")}>Privacy</button><button onClick={openContact}>Contact</button></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Girl Prints</span><span>ART PRINTS. ALL PERSONALITY. <span aria-hidden="true">✦</span></span></div></footer>

    {viewing && viewedPrint && <PrintViewer key={viewedPrint.id} print={viewedPrint} initialVariantId={viewing.variantId} demo={demo} onClose={() => setViewing(null)} add={add} />}
    <Modal open={cartOpen} title="Your bag" onClose={() => setCartOpen(false)} kind="bag-modal">
      {count > 0 && <><h2>YOUR BAG</h2><p className="modal-subtitle">{`${count} ${count === 1 ? "print" : "prints"}, a whole new mood.`}</p></>}
      {bagNotice && <p role="status" className="notice">{bagNotice}</p>}
      {!cart.length ? <div className="empty-bag"><h2>YOUR BAG<br />IS EMPTY.</h2><p>Find your print. Choose a size. Make it yours.</p><button className="primary" onClick={() => { setCartOpen(false); document.getElementById("prints")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }}>Explore prints <span aria-hidden="true">↗</span></button></div> :
        <>
          <ul className="cart-lines">{cart.map((line) => {
            const found = variants.get(line.variantId); if (!found) return null;
            return <li key={line.variantId} className="cart-line"><img src={found.print.image} alt={found.print.title} width={80} height={100} /><div className="cart-line-info"><h3>{found.print.title}</h3><p>{found.variant.size} · Unframed print</p><div className="quantity"><button disabled={pending || line.quantity <= 1} onClick={() => quantity(line.variantId, line.quantity - 1)} aria-label={`Decrease ${found.print.title} quantity`}>−</button><span aria-label={`Quantity ${line.quantity}`}>{line.quantity}</span><button disabled={pending || line.quantity >= 10} onClick={() => quantity(line.variantId, line.quantity + 1)} aria-label={`Increase ${found.print.title} quantity`}>+</button></div></div><div className="cart-line-price"><strong>{money(found.variant.priceCents * line.quantity)}</strong><button disabled={pending} className="text-button" aria-label={`Remove ${found.print.title}`} onClick={() => quantity(line.variantId, 0)}>Remove</button></div></li>;
          })}</ul>
          <div className="cart-summary"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>US shipping</span><span>Free</span></div><p>Any applicable tax is calculated at checkout.</p>
            {!checkoutEnabled && <p className="notice">{demo ? "This is a preview bag. Sample prints can’t be purchased." : "We’re putting the finishing touches on the shop. Checkout opens soon."}</p>}
            {checkoutError && <p role="alert" className="error">{checkoutError}</p>}
            <button className="primary checkout-button" disabled={!checkoutEnabled || pending} onClick={checkout}>{pending ? "Opening secure checkout…" : checkoutEnabled ? "Checkout" : "Shopping opens soon"} <span aria-hidden="true">↗</span></button>
            <p className="secure-note">Secure payment with Stripe · USD</p>
            <button className="text-button keep-shopping" onClick={() => setCartOpen(false)}>Back to the prints</button>
          </div>
        </>}
    </Modal>
    <Modal open={contactOpen} title="Contact" onClose={() => setContactOpen(false)}>
      <p className="eyebrow">THE DIRECT LINE</p><h2>GET IN TOUCH.</h2><p className="modal-subtitle">Print questions, order help, or a simple hello.</p><ContactForm />
    </Modal>
    <Modal open={paymentOpen} title="Payment status" onClose={closePayment}>
      <div className="payment-result"><span aria-hidden="true">✦</span><h2>{paymentState === "paid" ? "YOU’RE ALL SET." : paymentState === "syncing" ? "Payment received." : paymentState === "error" ? "Let’s check on that." : "One little moment…"}</h2>
        <p role="status">{paymentState === "paid" ? `Your order ${paymentReference} is confirmed. Your confirmation email is on its way.` :
          paymentState === "syncing" ? "Your payment is confirmed. We’re finishing your order and email. You don’t need to pay again." :
          paymentState === "pending" ? "Stripe is still confirming your payment. This can take a little while. Please don’t submit another payment." :
          paymentState === "error" ? "We couldn’t verify the payment right now. Check again or contact us before trying another payment." :
          "We’re securely checking your payment with Stripe."}</p>
        {paymentState !== "paid" && <button className="primary" onClick={() => { setRetry((r) => r + 1); }}>Check payment again</button>}
        <button className="text-button" onClick={closePayment}>Back to the prints</button>
        {paymentState !== "paid" && <button className="text-button" onClick={() => { closePayment(); openContact(); }}>Contact us</button>}
      </div>
    </Modal>
    <Modal open={!!policy} title={policy === "shipping" ? "Shipping and returns" : "Privacy"} onClose={() => setPolicy(null)}>
      <h2>{policy === "shipping" ? "THE DETAILS." : "Your privacy matters."}</h2>
      {policy === "shipping" ? <div className="policy-copy"><h3>Prints, just for your space</h3><p>All products are physical, unframed art prints. Please check the selected size before ordering.</p><h3>Shipping</h3><p>Checkout accepts US shipping addresses with free shipping. For other destinations, please contact us before placing an order.</p><h3>Delivery & returns</h3><p>{demo ? "This collection is a preview. Dispatch times and the return policy will be confirmed before shopping opens." : "Please contact us for the current dispatch estimate and return conditions before ordering. If an order arrives damaged or incorrect, send us your order reference and a description so we can help."}</p><button className="outline-button" onClick={openContact}>Ask us about your order ↗</button></div> :
        <div className="policy-copy"><p>Your bag is saved in this browser’s local storage. We don’t add advertising trackers.</p><p>When you contact us, your name, email and message are sent through Resend so we can reply. A hashed email identifier is temporarily stored to limit spam.</p><p>Stripe handles payment details. We store your order, contact and shipping information in Supabase to fulfill your purchase; order notifications are sent through Resend.</p><p>Contact us to ask about access to or deletion of your data. Some order records may need to be retained for legal obligations.</p><button className="outline-button" onClick={openContact}>Contact us ↗</button></div>}
    </Modal>
  </>;
}
