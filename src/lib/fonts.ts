import { Fira_Code, JetBrains_Mono } from "next/font/google";

/**
 * Self-hosted coding fonts (no runtime CDN calls). Exposed as CSS variables so
 * the Code Image tool can resolve their real family names for canvas rendering
 * — canvas font shorthand can't read `var()`, so we read the resolved value
 * from `getComputedStyle` at draw time.
 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira",
  display: "swap",
});
