import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import localFont from "next/font/local";

import { AppFrame } from "@/components/layout/app-shell";
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

// Display serif for a few italic accent words in headlines. Self-hosted by
// next/font at build time, so it also works offline once built.
const display = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap"
});

export const metadata: Metadata = {
  title: { default: az.app.name, template: `%s · ${az.app.name}` },
  description: az.app.description,
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az" className={`${plexSans.variable} ${plexMono.variable} ${display.variable}`}>
      <body className="min-h-screen">
        <Providers>
          <AppFrame>{children}</AppFrame>
        </Providers>
      </body>
    </html>
  );
}
