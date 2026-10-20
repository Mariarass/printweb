import { stripeClient } from "@/lib/stripe";
import { shopId } from "@/lib/config";
import { fulfillSession } from "@/lib/fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("session_id") ?? "";
  const headers = { "Cache-Control": "no-store" };
  if (!/^cs_(test_|live_)?[A-Za-z0-9]{10,240}$/.test(id)) return Response.json({ error: "Invalid payment reference." }, { status: 400, headers });
  try {
    const session = await stripeClient().checkout.sessions.retrieve(id);
    if (session.metadata?.shop !== shopId()) return Response.json({ error: "Payment not found." }, { status: 404, headers });
    if (session.payment_status !== "paid") return Response.json({ paid: false, saved: false }, { headers });
    try {
      return Response.json(await fulfillSession(session), { headers });
    } catch {
      // Payment is genuinely confirmed; never suggest making a second payment.
      return Response.json({ paid: true, saved: false }, { headers });
    }
  } catch {
    return Response.json({ error: "We couldn’t verify payment yet. Please check again." }, { status: 502, headers });
  }
}
