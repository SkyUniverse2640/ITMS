import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { TicketMetaProvider } from "@/components/providers/ticket-meta-provider";
import { BrandProvider } from "@/components/providers/brand-provider";
import { ToastProvider } from "@/components/ui/toast";
import { getBrandAppearance } from "@/lib/brand";
import { DEFAULT_BRAND } from "@/lib/brand-shared";
import "./globals.css";

/** Required for correct mobile scaling / touch layout */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandAppearance();
  return {
    title: {
      default: `${brand.appName} — IT Service Management`,
      template: `%s — ${brand.appName}`,
    },
    description: "IT Service Management System",
    icons: {
      icon: brand.icon || brand.logo || DEFAULT_BRAND.icon,
      apple: brand.icon || brand.logo || DEFAULT_BRAND.icon,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBrandAppearance();

  // Apply system color before paint (avoids blue flash / blank vars)
  const systemColorBoot = `(function(){try{var r=localStorage.getItem("nexusdesk-prefs");var c="blue";if(r){var p=JSON.parse(r);if(p&&(p.systemColor==="purple"||p.systemColor==="green"||p.systemColor==="cyan"||p.systemColor==="blue"))c=p.systemColor;}document.documentElement.setAttribute("data-system-color",c);}catch(e){document.documentElement.setAttribute("data-system-color","blue");}})();`;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
      data-system-color="blue"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: systemColorBoot }} />
      </head>
      <body className="min-h-dvh min-h-screen antialiased bg-background text-foreground overflow-x-hidden">
        <ThemeProvider>
          <BrandProvider initial={brand}>
            <AuthProvider>
              <PreferencesProvider>
                <TicketMetaProvider>
                  <ToastProvider>{children}</ToastProvider>
                </TicketMetaProvider>
              </PreferencesProvider>
            </AuthProvider>
          </BrandProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
