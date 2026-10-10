import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { SiteFooter } from "@/components/site-footer";
import { ScaleProvider } from "@/components/scale-provider";
import { SiteHeader } from "@/components/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "F1 Ratings",
  description: "Elo ratings for Formula 1 drivers, built from teammate head-to-heads.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ScaleProvider>
            <TooltipProvider>
              <SiteHeader />
              <main className="mx-auto w-full max-w-6xl flex-1 px-4">{children}</main>
              <SiteFooter />
            </TooltipProvider>
          </ScaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
