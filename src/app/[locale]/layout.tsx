
import type { Metadata } from "next";
import { Geist, Cairo } from "next/font/google";
import { getMessages } from "next-intl/server";
import { ReactNode } from "react";

import "./../globals.css";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { getAppTranslation } from "@/lib/i18n/getTranslations";
import { cn } from "@/lib/utils";
import { AppProvider } from "@/providers/AppProvider";
import { SupportedLocale } from "@/types";


export function generateStaticParams() {
  return [{ locale: "ar" }, { locale: "en" }];
}

interface Props {
  children: ReactNode,
  params: Promise<{ locale: string }>
}


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
});


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params

  const { t } = await getAppTranslation(
    locale,
    "metaData"
  );

  return {
    title: {
      template: `%s | ${t("title")}`,
      default: t("title"),
    },
    description: t("description"),
    metadataBase: new URL("https://your-domain.com"),
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      siteName: t("title"),
    },
  };
}

/**
 * Root Layout Component
 * Handles Global Providers, Fonts, and Internationalization (i18n).
 * Uses suppressHydrationWarning because of next-themes.
 */
export default async function RootLayout({
  children,
  params,
}: Props) {
  const { locale } = await params;

  // Fetch messages for the Client-side provider
  const messages = await getMessages({ locale: locale as any });
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
    >
      <body
        className={cn(
          "min-h-screen bg-background antialiased font-sans",
          geistSans.variable,
          cairo.variable
        )}
      >
        <AppProvider locale={locale as SupportedLocale} messages={messages}>
          <Header />
          {children}
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}