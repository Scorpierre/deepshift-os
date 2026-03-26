import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DeepShift OS",
  description: "Système de gestion interne DeepShift",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geist.variable} h-full dark`}>
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
