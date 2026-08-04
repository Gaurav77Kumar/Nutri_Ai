import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import "./mobile.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NutriAI — Smart Nutrition Tracking for India",
  description:
    "AI-powered daily food logging with weekly insights. Built for Indian food, home-cooked meals, and desi eating patterns. Track, learn, thrive.",
  keywords: [
    "nutrition tracker",
    "calorie counter",
  ],
};

import { GoogleAuthProvider } from "@/components/auth/google-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/language-context";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#0a0a0f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#059669" />
      </head>
      <body className="min-h-full flex flex-col relative overflow-x-hidden safe-top">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <GoogleAuthProvider>
            <LanguageProvider>
              <TooltipProvider>
                {/* Ambient background orbs */}
                <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                  <div
                    className="ambient-orb absolute -top-40 -left-40 w-96 h-96 opacity-20"
                    style={{ background: "oklch(0.696 0.17 162.48 / 40%)" }}
                  />
                  <div
                    className="ambient-orb absolute top-1/3 -right-32 w-80 h-80 opacity-15"
                    style={{
                      background: "oklch(0.606 0.25 292.717 / 30%)",
                      animationDelay: "-7s",
                    }}
                  />
                  <div
                    className="ambient-orb absolute -bottom-40 left-1/3 w-96 h-96 opacity-10"
                    style={{
                      background: "oklch(0.769 0.188 70.08 / 30%)",
                      animationDelay: "-14s",
                    }}
                  />
                </div>
                {children}
              </TooltipProvider>
            </LanguageProvider>
          </GoogleAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
