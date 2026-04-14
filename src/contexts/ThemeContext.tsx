import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";
type FontSize = "sm" | "md" | "lg";
type Density = "comfortable" | "compact";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolvedTheme: "light" | "dark";
  fontSize: FontSize;
  setFontSize: (f: FontSize) => void;
  density: Density;
  setDensity: (d: Density) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const fontSizeMap: Record<FontSize, string> = { sm: "14px", md: "16px", lg: "18px" };

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "system");
  const [fontSize, setFontSizeState] = useState<FontSize>(() => (localStorage.getItem("fontSize") as FontSize) || "md");
  const [density, setDensityState] = useState<Density>(() => (localStorage.getItem("density") as Density) || "comfortable");

  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [resolvedTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      // Force re-render by toggling state
      setThemeState("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Apply font size
  useEffect(() => {
    document.documentElement.style.setProperty("--font-size-base", fontSizeMap[fontSize]);
    document.documentElement.style.fontSize = fontSizeMap[fontSize];
  }, [fontSize]);

  // Apply density
  useEffect(() => {
    document.body.classList.toggle("compact", density === "compact");
  }, [density]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("theme", t);
  }, []);

  const setFontSize = useCallback((f: FontSize) => {
    setFontSizeState(f);
    localStorage.setItem("fontSize", f);
  }, []);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    localStorage.setItem("density", d);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, fontSize, setFontSize, density, setDensity }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
