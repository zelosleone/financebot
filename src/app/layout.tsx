import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MissingKeysDialog } from "@/components/missing-keys-dialog";
import { OllamaProvider } from "@/lib/ollama-context";
import { Analytics } from '@vercel/analytics/next';
import { AuthInitializer } from "@/components/auth/auth-initializer";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { PostHogProvider } from "@/components/posthog-provider";
import { logEnvironmentStatus } from "@/lib/env-validation";
import { LocalModelStatus } from "@/components/local-model-status";
import { MigrationBanner } from "@/components/migration-banner";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  title: {
    default: "FinanceBot",
    template: "%s | FinanceBot",
  },
  description:
    "AI financial analysis with real-time data, secure Python execution, and interactive visualizations for research and reporting.",
  applicationName: "FinanceBot",
  openGraph: {
    title: "FinanceBot",
    description:
      "AI financial analysis with real-time data, secure Python execution, and interactive visualizations.",
    url: "/",
    siteName: "FinanceBot",
    images: [
      {
        url: "/valyu.png",
        width: 1200,
        height: 630,
        alt: "FinanceBot",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FinanceBot",
    description:
      "AI-powered financial analysis with real-time data, secure Python execution, and interactive visualizations for research and reporting.",
    images: ["/valyu.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Log environment status on server-side render
  if (typeof window === 'undefined') {
    logEnvironmentStatus();
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthInitializer>
              <PostHogProvider>
                <OllamaProvider>
                  <MissingKeysDialog />
                  <LocalModelStatus />
                  <MigrationBanner />
                  {children}
                  <Analytics />
                </OllamaProvider>
              </PostHogProvider>
            </AuthInitializer>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}