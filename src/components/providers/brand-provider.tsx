"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_BRAND,
  normalizeBrandAppearance,
  type BrandAppearance,
} from "@/lib/brand-shared";
import { systemFontStack, withBrandCacheBust } from "@/lib/public-assets";

interface BrandContextType extends BrandAppearance {
  loading: boolean;
  refreshBrand: () => Promise<void>;
}

const BrandContext = createContext<BrandContextType>({
  ...DEFAULT_BRAND,
  loading: true,
  refreshBrand: async () => {},
});

const FONT_STYLE_ID = "nexusdesk-brand-font";

function applyDocumentBrand(brand: BrandAppearance) {
  if (typeof document === "undefined") return;

  const titleBase = brand.appName || DEFAULT_BRAND.appName;
  document.title = `${titleBase} — IT Service Management`;

  // App Icon → favicon / title icon (always via resolved media URL)
  const icon = brand.icon || brand.logo || DEFAULT_BRAND.icon;
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = withBrandCacheBust(icon, icon);

  let apple = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
  if (!apple) {
    apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    document.head.appendChild(apple);
  }
  apple.href = link.href;

  // Global font system
  let styleEl = document.getElementById(FONT_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = FONT_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const fontUrl = brand.fontUrl?.trim() || "";
  const family = brand.font || DEFAULT_BRAND.font;
  const stack = systemFontStack(family);

  if (fontUrl) {
    const ext = fontUrl.split(".").pop()?.toLowerCase() || "";
    const format =
      ext === "woff2"
        ? "woff2"
        : ext === "woff"
          ? "woff"
          : ext === "otf"
            ? "opentype"
            : "truetype";
    styleEl.textContent = `
@font-face {
  font-family: "${family.replace(/"/g, "")}";
  src: url("${fontUrl}") format("${format}");
  font-display: swap;
  font-weight: 100 900;
  font-style: normal;
}
:root {
  --font-sans: "${family.replace(/"/g, "")}", ui-sans-serif, system-ui, sans-serif;
}
html, body {
  font-family: var(--font-sans) !important;
}
`;
  } else {
    styleEl.textContent = `
:root {
  --font-sans: ${stack};
}
html, body {
  font-family: var(--font-sans) !important;
}
`;
  }

  document.documentElement.style.setProperty("--font-sans", fontUrl ? `"${family}"` : stack);
  document.body.style.fontFamily = "var(--font-sans)";
}

export function BrandProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: BrandAppearance;
}) {
  const [brand, setBrand] = useState<BrandAppearance>(
    initial ? normalizeBrandAppearance(initial) : DEFAULT_BRAND
  );
  const [loading, setLoading] = useState(!initial);

  const refreshBrand = useCallback(async () => {
    try {
      const res = await fetch("/api/brand", { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.data) {
        const next = normalizeBrandAppearance(data.data);
        setBrand(next);
        applyDocumentBrand(next);
      }
    } catch {
      /* keep current */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initial) {
      const n = normalizeBrandAppearance(initial);
      applyDocumentBrand(n);
      setLoading(false);
    }
    void refreshBrand();
  }, [initial, refreshBrand]);

  return (
    <BrandContext.Provider value={{ ...brand, loading, refreshBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}
