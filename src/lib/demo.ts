import type { Print } from "./types";

// Design samples only. The server never accepts these IDs for paid checkout.
export const demoPrints: Print[] = [
  { id: "demo-angel", title: "Chrome angel", description: "Cold chrome. Electric blue. A little heaven after dark.", image: "/prints/chrome-angel.svg", category: "Dreamy", variants: [] },
  { id: "demo-bow", title: "Kiss & tell", description: "A graphic kiss with a very loud point of view.", image: "/prints/kiss.svg", category: "Coquette", variants: [] },
  { id: "demo-butterfly", title: "Butterfly.exe", description: "Your 2000s desktop fantasy, reimagined for the wall.", image: "/prints/butterfly-2000.svg", category: "Y2K", variants: [] },
  { id: "demo-daydream", title: "Offline looks good", description: "Log off. Turn it up. Take up a little more space.", image: "/prints/offline.svg", category: "Dreamy", variants: [] },
  { id: "demo-cherry", title: "All eyes on you", description: "A sharp stare and a full-volume graphic statement.", image: "/prints/eyes.svg", category: "Coquette", variants: [] },
  { id: "demo-star", title: "Star power", description: "Heavy metal, bright blue and main character energy.", image: "/prints/star-power.svg", category: "Y2K", variants: [] },
].map((print) => ({
  ...print,
  images: [print.image.replace(".svg", "-detail.svg"), print.image.replace(".svg", "-room.svg")],
  category: print.category as Print["category"],
  variants: [
    { id: `${print.id}-small`, size: "8 × 10 in", priceCents: 1800 },
    { id: `${print.id}-large`, size: "12 × 16 in", priceCents: 2800 },
  ],
}));
