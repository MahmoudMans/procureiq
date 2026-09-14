import type {
  Metadata,
} from "next";

import type {
  ReactNode,
} from "react";

import {
  AppShell,
} from "@/components/layout/app-shell";

import {
  AuthProvider,
} from "@/components/auth/auth-provider";

import "./globals.css";

export const metadata: Metadata = {
  title:
    "ProcureIQ | Procurement Intelligence",

  description:
    "Enterprise procurement and supplier intelligence platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppShell>
            {children}
          </AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
