import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/hooks/useI18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const domain = process.env.NEXT_PUBLIC_DOMAIN || "https://pdfgen.ai";

export const metadata: Metadata = {
  title: {
    default: "PDFGenAI - AI-Powered Professional PDF Generation",
    template: "%s | PDFGenAI"
  },
  description: "Transform your data into professional PDFs with AI-powered templates. Managed browser clusters, high scalability, and seamless integration.",
  keywords: ["PDF generation", "AI templates", "HTML to PDF", "Developer Tools", "Managed Browser", "Dynamic PDFs"],
  authors: [{ name: "PDFGenAI Team" }],
  creator: "PDFGenAI",
  publisher: "PDFGenAI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(domain),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "PDFGenAI - Professional PDF Generation for Developers",
    description: "The most powerful way to generate PDFs using AI and modern web technologies.",
    url: domain,
    siteName: "PDFGenAI",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PDFGenAI - AI-Powered PDF Generation",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PDFGenAI - AI-Powered Professional PDF Generation",
    description: "Managed infrastructure for flawless PDF generation from HTML/React.",
    images: ["/og-image.png"],
    creator: "@pdfgenai",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
