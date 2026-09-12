"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { NavLayout } from "@/lib/nav-config";

export type SystemColor = "blue" | "purple" | "green" | "cyan";

interface Preferences {
  navLayout: NavLayout;
  menuOrder: string[];
  systemColor: SystemColor;
}

interface PreferencesContextType extends Preferences {
  setNavLayout: (layout: NavLayout) => void;
  setMenuOrder: (order: string[]) => void;
  setSystemColor: (color: SystemColor) => void;
  mounted: boolean;
}

const STORAGE_KEY = "nexusdesk-prefs";

const defaults: Preferences = {
  navLayout: "sidebar",
  menuOrder: [],
  systemColor: "blue",
};

function applySystemColor(color: SystemColor) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // Always set a concrete value so CSS selectors match reliably
  const next: SystemColor =
    color === "purple" || color === "green" || color === "cyan" || color === "blue"
      ? color
      : "blue";
  root.setAttribute("data-system-color", next);
}

const PreferencesContext = createContext<PreferencesContextType>({
  ...defaults,
  setNavLayout: () => {},
  setMenuOrder: () => {},
  setSystemColor: () => {},
  mounted: false,
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Preferences>;
        const systemColor: SystemColor =
          parsed.systemColor === "purple" ||
          parsed.systemColor === "green" ||
          parsed.systemColor === "cyan" ||
          parsed.systemColor === "blue"
            ? parsed.systemColor
            : "blue";
        const next = {
          navLayout: parsed.navLayout || "sidebar",
          menuOrder: parsed.menuOrder || [],
          systemColor,
        };
        setPrefs(next);
        applySystemColor(next.systemColor);
      } else {
        applySystemColor("blue");
      }
    } catch {
      applySystemColor("blue");
    }
    setMounted(true);
  }, []);

  const persist = useCallback((next: Preferences) => {
    setPrefs(next);
    applySystemColor(next.systemColor);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setNavLayout = useCallback(
    (navLayout: NavLayout) => {
      persist({ ...prefs, navLayout });
    },
    [persist, prefs]
  );

  const setMenuOrder = useCallback(
    (menuOrder: string[]) => {
      persist({ ...prefs, menuOrder });
    },
    [persist, prefs]
  );

  const setSystemColor = useCallback(
    (systemColor: SystemColor) => {
      persist({ ...prefs, systemColor });
    },
    [persist, prefs]
  );

  return (
    <PreferencesContext.Provider
      value={{ ...prefs, setNavLayout, setMenuOrder, setSystemColor, mounted }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export const usePreferences = () => useContext(PreferencesContext);
