import type { Metadata, Viewport } from "next";
import { demoMode, siteOrigin } from "@/lib/config";
import "./globals.css";

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteOrigin()),
    title: "Girl Prints — Art prints with attitude.",
    description: "Graphic art prints with attitude. Chrome, statement typography and 2000s-inspired wall art. Your space, your rules.",
    alternates: { canonical: "/" },
    robots: demoMode() ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title: "Girl Prints", description: "Art prints with attitude.", type: "website" },
  };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#08090c" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
