import { getCatalog } from "@/lib/catalog";
import { checkoutReady } from "@/lib/config";
import Shop from "@/components/Shop";

export const dynamic = "force-dynamic";

export default async function Home() {
  const catalog = await getCatalog();
  return <Shop {...catalog} checkoutEnabled={checkoutReady()} />;
}
