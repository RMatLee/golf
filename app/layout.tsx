/**
 * Root layout — applied to every route in the application.
 *
 * Sets up:
 *  - Google Fonts (Inter, Geist Sans, Geist Mono) via CSS variables
 *  - `<Providers>` — injects AuthContext at the tree root
 *  - `<Navbar>` — fixed navigation rendered above all page content
 *  - `<ErrorBoundary section="Page">` — catches page-level render crashes
 *  - `<Toaster>` (Sonner) — global toast notifications, bottom-right, dark theme
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import { Providers } from "@/components/providers";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ryan's Golf Tracker",
  description: "Personal golf round and stats tracker",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", inter.variable)}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <Navbar />
          <ErrorBoundary section="Page">
            {children}
          </ErrorBoundary>
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              style: { background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
