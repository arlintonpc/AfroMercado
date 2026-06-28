import type { Metadata } from "next";
import { Inter, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

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
  title: "AfroMercado — Del Chocó para el mundo",
  description: "Marketplace cultural del Chocó. Productos ancestrales, artesanías, gastronomía y turismo afrochocoano e indígena.",
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
      </body>
    </html>
  );
}
