import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { AuthProvider } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/layout/app-shell";

import "./globals.css";
// theme.css MUST stay after globals.css: it layers dark mode and the
// refreshed look on top of the existing styles without touching them.
import "./theme.css";

// Real Inter (the old CSS named Inter but never loaded it).
// Offline build? Delete this font block and the className below — everything else still works.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProcureIQ | Procurement Intelligence",

  description:
    "Enterprise procurement and supplier intelligence platform.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1a" },
  ],
};

// Runs before first paint so a dark-mode user never sees a white flash.
// Mirrors the logic in components/layout/theme-toggle.tsx.
const themeInitScript = `(function(){try{var p=localStorage.getItem("procureiq.theme")||"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>

      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
