import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { ErrorBoundary } from "@/components/error-boundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AuthVerify — Counterfeit Detection Co-Pilot",
  description: "Scan any branded product or medicine with your phone camera. AuthVerify checks for counterfeit red flags and compares against genuine references from the web. Africa-first, global reach.",
  keywords: ["counterfeit detection", "fake medicine", "NAFDAC", "product authenticity", "anti-counterfeit", "Africa", "consumer protection"],
  authors: [{ name: "AuthVerify" }],
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icon.svg",
  },
  openGraph: {
    title: "AuthVerify — Counterfeit Detection Co-Pilot",
    description: "Scan any product. Get an honest verdict on whether it's authentic or fake.",
    url: "https://chat.z.ai",
    siteName: "AuthVerify",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AuthVerify — Counterfeit Detection Co-Pilot",
    description: "Scan any product. Get an honest verdict on whether it's authentic or fake.",
  },
};

export const viewport = {
  themeColor: "#f59e0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
