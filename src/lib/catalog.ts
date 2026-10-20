import { demoMode } from "./config";
import { database } from "./db";
import { demoPrints } from "./demo";
import type { Print } from "./types";

export async function getCatalog(): Promise<{ prints: Print[]; demo: boolean; unavailable: boolean }> {
  if (demoMode()) return { prints: demoPrints, demo: true, unavailable: false };
  try {
    const { data, error } = await database().from("gp_products")
      .select("id,title,description,image,images,category,gp_variants(id,size,price_cents,active)")
      .eq("active", true).order("sort_order");
    if (error) throw error;
    const prints = (data ?? []).map((p) => ({
      id: p.id, title: p.title, description: p.description, image: p.image,
      images: Array.isArray(p.images) ? p.images.filter((image): image is string => typeof image === "string" && image.trim().length > 0) : [],
      category: p.category as Print["category"],
      variants: p.gp_variants.filter((v) => v.active).map((v) => ({
        id: v.id, size: v.size, priceCents: v.price_cents,
      })),
    })).filter((p) => p.variants.length > 0);
    return { prints, demo: false, unavailable: false };
  } catch {
    console.error("[catalog] Could not read the new shop catalog.");
    return { prints: [], demo: false, unavailable: true };
  }
}
