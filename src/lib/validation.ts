import type { CartLine } from "./types";

export function parseCart(value: unknown): CartLine[] {
  if (!Array.isArray(value) || !value.length || value.length > 20) throw new Error("Choose between 1 and 20 different prints.");
  const seen = new Set<string>();
  return value.map((line: unknown) => {
    if (!line || typeof line !== "object") throw new Error("Your bag could not be read.");
    const l = line as Record<string, unknown>;
    if (typeof l.variantId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(l.variantId) ||
      seen.has(l.variantId) || !Number.isSafeInteger(l.quantity) || Number(l.quantity) < 1 || Number(l.quantity) > 10 ||
      !Number.isSafeInteger(l.expectedPriceCents) || Number(l.expectedPriceCents) < 1) {
      throw new Error("Please update your bag and try again. Maximum 10 of each print.");
    }
    seen.add(l.variantId);
    return { variantId: l.variantId, quantity: Number(l.quantity), expectedPriceCents: Number(l.expectedPriceCents) };
  });
}

export function parseContact(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Please fill in the form.");
  const input = value as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const website = typeof input.website === "string" ? input.website : "";
  if (!name || name.length > 100 || /[\r\n]/.test(name)) throw new Error("Please enter a name under 100 characters.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email.");
  if (message.length < 5 || message.length > 4000) throw new Error("Your message should be between 5 and 4,000 characters.");
  return { name, email, message, website };
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
