import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "YourBiz CRM — Simple, powerful CRM for growing businesses",
    template: "%s · YourBiz CRM",
  },
  description:
    "YourBiz CRM brings your contacts, deals, tasks and team into one beautiful workspace. Multi-currency, multi-timezone, and built for teams in India and around the world.",
  keywords: [
    "YourBiz CRM",
    "CRM",
    "sales CRM",
    "pipeline",
    "contacts",
    "deals",
    "India CRM",
    "multi currency CRM",
    "small business CRM",
  ],
  authors: [{ name: "YourBiz CRM" }],
  openGraph: {
    title: "YourBiz CRM — Simple, powerful CRM for growing businesses",
    description:
      "Contacts, deals, tasks and team in one workspace. Multi-currency, multi-timezone. Built for India and the world.",
    siteName: "YourBiz CRM",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "YourBiz CRM",
    description:
      "Simple, powerful CRM for growing businesses. Multi-currency, multi-timezone.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#1a2320" },
  ],
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
