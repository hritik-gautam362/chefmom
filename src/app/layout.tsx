import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import MobileNav from "@/components/MobileNav";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chef Mom — Your ingredients. Endless possibilities.",
  description:
    "Your friendly kitchen companion. Discover tailored recipes, generate dishes from what's in your kitchen, and cook step-by-step with ease.",
  applicationName: "Chef Mom",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Chef Mom",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#243B30",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable}`}>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
      </head>
      <body className="bg-background text-foreground antialiased selection:bg-accent/20 selection:text-foreground relative min-h-screen font-sans">
        {/* Subtle, softly blurred botanical shapes near selected edges */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-35"
        >
          {/* Top-right soft botanical blur orb */}
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#D5DED3] blur-[80px]" />
          {/* Subtle botanical herb silhouette in top-right */}
          <svg
            className="absolute -top-10 -right-10 h-72 w-72 text-[#CAD6C7] opacity-40 blur-[1px] rotate-45"
            viewBox="0 0 120 120"
            fill="currentColor"
          >
            <path d="M60 5 C80 35 105 45 115 60 C105 75 80 85 60 115 C40 85 15 75 5 60 C15 45 40 35 60 5 Z" />
          </svg>

          {/* Mid-left soft botanical blur orb */}
          <div className="absolute top-1/2 -left-28 h-80 w-80 rounded-full bg-[#D8E2D5] blur-[90px]" />
          <svg
            className="absolute top-[52%] -left-12 h-60 w-60 text-[#CAD6C7] opacity-35 blur-[1.5px] -rotate-12"
            viewBox="0 0 120 120"
            fill="currentColor"
          >
            <path d="M60 10 C75 35 95 50 110 60 C95 70 75 85 60 110 C45 85 25 70 10 60 C25 50 45 35 60 10 Z" />
          </svg>
        </div>

        <div className="relative z-10 flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1 pb-28 sm:pb-32 md:pb-12">{children}</main>
          <MobileNav />
          <PWAInstallPrompt />
        </div>
      </body>
    </html>
  );
}
