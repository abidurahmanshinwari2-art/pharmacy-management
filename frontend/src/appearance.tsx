import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const THEMES = [
  { id: "leaf", colors: ["#0b3d32", "#0b7c56", "#f4f7f5"] },
  { id: "pine", colors: ["#12352c", "#c9a227", "#f3f0e6"] },
  { id: "ink", colors: ["#d6e4f5", "#e09f1f", "#ffffff"] },
  { id: "ruby", colors: ["#f8d9d6", "#e06b4f", "#ffffff"] },
  { id: "teal", colors: ["#d2efe9", "#2a9d8f", "#ffffff"] },
  { id: "stone", colors: ["#efe4d4", "#d4783a", "#fffdf9"] },
] as const;

export const FONTS = [
  { id: "shop" },
  { id: "clear" },
  { id: "naskh" },
  { id: "simple" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type FontId = (typeof FONTS)[number]["id"];

const MIN = 10;
const MAX = 16;

function clamp(value: number) {
  return Math.min(MAX, Math.max(MIN, Math.round(Number(value) || 16)));
}

type LookValue = {
  theme: ThemeId;
  font: FontId;
  textSize: number;
  setTheme: (id: ThemeId) => void;
  setFont: (id: FontId) => void;
  setTextSize: (n: number) => void;
};

const LookContext = createContext<LookValue | null>(null);

function applyLook(theme: string, font: string, textSize: number) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.font = font;
  document.documentElement.style.setProperty("--text-size", `${textSize}px`);
}

export function LookProvider({ children }: { children: ReactNode }) {
  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem("pharmacy_look") || "{}");
    } catch {
      return {};
    }
  })();
  const [theme, setThemeState] = useState<ThemeId>(saved.theme || "leaf");
  const [font, setFontState] = useState<FontId>(saved.font || "shop");
  const [textSize, setTextSizeState] = useState(clamp(saved.textSize ?? 16));

  useEffect(() => {
    applyLook(theme, font, textSize);
    localStorage.setItem("pharmacy_look", JSON.stringify({ theme, font, textSize }));
  }, [theme, font, textSize]);

  const value = useMemo<LookValue>(
    () => ({
      theme,
      font,
      textSize,
      setTheme: setThemeState,
      setFont: setFontState,
      setTextSize: (n) => setTextSizeState(clamp(n)),
    }),
    [theme, font, textSize]
  );

  return <LookContext.Provider value={value}>{children}</LookContext.Provider>;
}

export function useLook() {
  const ctx = useContext(LookContext);
  if (!ctx) throw new Error("LookProvider missing");
  return ctx;
}
