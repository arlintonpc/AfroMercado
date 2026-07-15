import type { Metadata } from "next";
import { Inter, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Providers from "@/components/Providers";
import PWARegister from "@/components/PWARegister";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const dmSerifDisplay = DM_Serif_Display({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://afro-mercado.vercel.app"),
  title: "Teravia — Productos y Servicios de Colombia",
  description: "Descubre productos artesanales, hoteles, tours, restaurantes, transporte y cultura de comunidades afro, indígenas y campesinas de todo el país, nacido en el Chocó.",
  openGraph: {
    title: "Teravia — Productos y Servicios de Colombia",
    description: "Descubre productos artesanales, hoteles, tours, restaurantes, transporte y cultura de comunidades afro, indígenas y campesinas de todo el país, nacido en el Chocó.",
    images: [{ url: "/og-logo.png", width: 1200, height: 630, alt: "Teravia" }],
    locale: "es_CO",
    type: "website",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Teravia",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${dmSerifDisplay.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-[#F8F5F0] text-[#1A1A1A] antialiased">
        <Providers>{children}</Providers>
        <PWARegister />
      </body>
    </html>
  );
}
