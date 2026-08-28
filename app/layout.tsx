import type { Metadata } from "next";
import { Archivo, Bodoni_Moda, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

import { GlobalSearch } from "./components/global-search";
import { SiteNav } from "./components/site-nav";
import "./globals.css";
import "./global-search.css";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-bodoni",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Needle",
    template: "%s — Needle",
  },
  description: "A personal music-history archive.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${bodoni.variable} ${archivo.variable} ${plexMono.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <div className="site-frame">
          <header className="site-header">
            <Link className="wordmark" href="/" aria-label="Needle home">
              Needle
            </Link>
            <SiteNav />
            <GlobalSearch />
          </header>
          <div id="main-content" className="site-content">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
