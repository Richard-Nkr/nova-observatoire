import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Michroma } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/app-shell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const michroma = Michroma({
  variable: "--font-michroma",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nova Observatoire — Observatoire hôtelier",
    template: "%s · Nova Observatoire",
  },
  description:
    "Base de données hôtelière, cartographie, comparaison concurrentielle et exports pour le conseil hôtelier.",
  applicationName: "Nova Observatoire",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0f2433",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${michroma.variable} h-full`}
    >
      <body className="h-full antialiased">
        <Providers>
          <Suspense fallback={<div className="min-h-dvh bg-paper" />}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
