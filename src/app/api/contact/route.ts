import { createHmac } from "node:crypto";
import { Resend } from "resend";
import { dbReady } from "@/lib/config";
import { database } from "@/lib/db";
import { readJson } from "@/lib/http";
import { escapeHtml, parseContact } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let input;
  try { input = parseContact(await readJson(request)); }
  catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Please check your message." }, { status: 400 });
  }
  if (input.website) return Response.json({ ok: true });
  const key = process.env.GP_RESEND_API_KEY;
  const from = process.env.GP_RESEND_FROM;
  const to = process.env.GP_CONTACT_EMAIL;
  const salt = process.env.GP_RATE_LIMIT_SECRET;
  if (!key || !from || !to || !salt || !dbReady()) return Response.json({ error: "The contact form is getting ready. Please check back soon." }, { status: 503 });
  try {
    const identifier = createHmac("sha256", salt).update(input.email.toLowerCase()).digest("hex");
    const limit = await database().rpc("gp_allow_contact", { identifier });
    if (limit.error) throw limit.error;
    if (!limit.data) return Response.json({ error: "You’ve sent a few messages already. Please try again in an hour." }, { status: 429 });
    const { error } = await new Resend(key).emails.send({
      from, to, replyTo: input.email, subject: `Girl Prints · A note from ${input.name}`,
      html: `<h2>New message / Girl Prints</h2><p>${escapeHtml(input.name)} · ${escapeHtml(input.email)}</p><p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`,
    });
    if (error) throw new Error("Email rejected.");
    return Response.json({ ok: true });
  } catch {
    console.error("[contact] Message delivery failed.");
    return Response.json({ error: "Your message hasn’t been sent. Please try again in a moment." }, { status: 502 });
  }
}
