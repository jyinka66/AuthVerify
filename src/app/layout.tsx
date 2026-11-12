import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
