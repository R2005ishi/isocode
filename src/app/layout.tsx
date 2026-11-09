import type { Metadata, Viewport } from "next";
import { Anek_Devanagari, Mukta } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { siteUrl } from "@/lib/site";
import "./globals.css";

// Display: variable-width grotesk with Devanagari. Text: Mukta (Latin + Devanagari).
// Only the Latin subset is preloaded; Devanagari loads on demand via unicode-range.
const display = Anek_Devanagari({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});
const text = Mukta({
  variable: "--font-text",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t("defaultTitle"), template: `%s | ${t("siteName")}` },
    description: t("defaultDescription"),
    applicationName: t("siteName"),
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      title: t("defaultTitle"),
      description: t("defaultDescription"),
      images: [{ url: "/cars/model-h.svg", width: 1200, height: 600 }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#faf8f5",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${display.variable} ${text.variable}`}>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          {children}
          <Toaster theme="light" position="top-center" richColors={false} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
