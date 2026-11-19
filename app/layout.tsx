import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "DocuMind", template: "%s · DocuMind" },
  description: "Upload your documents, ask questions in plain language, and get answers that cite the exact passage.",
};

export const viewport: Viewport = { themeColor: "#050d0d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance} signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard">
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
