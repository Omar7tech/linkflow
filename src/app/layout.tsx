import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Footer } from "@/components/shared/footer";
import { Header } from "@/components/shared/header";
import { SwRegister } from "@/components/shared/sw-register";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { SITE } from "@/constants/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Free Link & QR Code Toolkit`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "link generator",
    "qr code generator",
    "whatsapp link",
    "utm builder",
    "vcard generator",
  ],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} — Free Link & QR Code Toolkit`,
    description: SITE.description,
    url: SITE.url,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — Free Link & QR Code Toolkit`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla) inject body attributes pre-hydration */}
      <body className="flex min-h-screen flex-col" suppressHydrationWarning>
        <ThemeProvider>
          <TooltipProvider>
            <Header />
            <main className="flex flex-1 flex-col">{children}</main>
            <Footer />
          </TooltipProvider>
          <Toaster position="bottom-center" />
        </ThemeProvider>
        <SwRegister />
      </body>
    </html>
  );
}
