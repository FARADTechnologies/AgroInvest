import type { Metadata } from "next";
import localFont from "next/font/local";

import { SiteHeader } from "@/components/layout/site-header";
import { Providers } from "@/components/providers";
import { az } from "@/messages/az";

import "./globals.css";

// Fonts ship with the app (OFL), so the portal renders correctly offline.
// Both were checked for every Azerbaijani letter: ə Ə İ ı ğ ş ç ö ü.
const plexSans = localFont({
  src: "../fonts/IBMPlexSans-Variable.woff2",
  weight: "100 700",
  variable: "--font-sans",
  display: "swap"
});

const plexMono = localFont({
  src: [
    { path: "../fonts/IBMPlexMono-Regular.woff2", weight: "400" },
    { path: "../fonts/IBMPlexMono-Medium.woff2", weight: "500" }
  ],
  variable: "--font-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: { default: az.app.name, template: `%s · ${az.app.name}` },
  description: az.app.description,
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-screen">
        <Providers>
          <SiteHeader />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
