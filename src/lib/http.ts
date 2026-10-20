import { siteOrigin } from "./config";

export async function readJson(request: Request) {
  if (request.headers.get("origin") !== siteOrigin()) throw new Error("Please submit this form from the shop.");
  if (!request.headers.get("content-type")?.includes("application/json")) throw new Error("Invalid request.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 20000) { await reader.cancel(); throw new Error("Request is too large."); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
