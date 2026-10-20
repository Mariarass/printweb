export type PrintVariant = {
  id: string;
  size: string;
  priceCents: number;
};

export type Print = {
  id: string;
  title: string;
  description: string;
  image: string;
  images?: string[];
  category: "Dreamy" | "Coquette" | "Y2K";
  variants: PrintVariant[];
};

export type CartLine = {
  variantId: string;
  quantity: number;
  expectedPriceCents: number;
};

// Keep stored category keys stable while giving the new edit its own labels.
export const categoryLabels: Record<Print["category"], string> = {
  Dreamy: "After hours",
  Coquette: "Icons",
  Y2K: "Y2K",
};

export type OrderLine = {
  variantId: string;
  title: string;
  size: string;
  quantity: number;
  unitAmount: number;
};

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(cents / 100);
