"use client";

import { useState } from "react";

export default function ContactForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(fields)),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your message couldn’t be sent.");
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Connection lost. Please try again."); }
    finally { setPending(false); }
  }
  if (done) return <div className="form-success" role="status"><span>✦</span><h3>MESSAGE RECEIVED.</h3><p>Your note is on its way. We’ll get back to you by email.</p><button className="text-button" onClick={() => setDone(false)}>Send another note</button></div>;
  return <form onSubmit={submit} className="contact-form">
    <div className="field"><label htmlFor="contact-name">Your name</label><input id="contact-name" name="name" placeholder="What should we call you?" autoComplete="name" maxLength={100} required /></div>
    <div className="field"><label htmlFor="contact-email">Email address</label><input id="contact-email" name="email" type="email" placeholder="you@somewhere.com" autoComplete="email" maxLength={254} required /></div>
    <div className="field"><label htmlFor="contact-message">Your message</label><textarea id="contact-message" name="message" placeholder="Print questions, order help, or just saying hi…" minLength={5} maxLength={4000} rows={4} required /></div>
    <div className="honeypot" aria-hidden="true"><label>Leave this blank<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {error && <p role="alert" className="error">{error}</p>}
    <button className="primary" type="submit" disabled={pending}>{pending ? "Sending…" : "SEND MESSAGE"} <span aria-hidden="true">↗</span></button>
    <p className="form-note">Your details are only used to reply to your message.</p>
  </form>;
}
