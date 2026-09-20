import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import { Nav } from "@/components/nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Inbox CRM",
  description:
    "Inbox-first pipeline CRM for freelancers. Google sign-in, read-only Gmail import, evidence-based deals.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} h-full antialiased`}>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap"
          rel="stylesheet"
        />
        <meta name="view-transition" content="same-origin" />
      </head>
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1" style={{ viewTransitionName: "main-content" }}>
          {children}
        </main>
      </body>
    </html>
  );
}