import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { SiteNav } from "./components/site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Needle",
    template: "%s — Needle",
  },
  description: "A personal music-history archive.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
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
          </header>
          <div id="main-content" className="site-content">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
