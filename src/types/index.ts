import type { LucideIcon } from "lucide-react";
// Type-only circular import — erased at runtime, resolved lazily by TypeScript.
import type { ToolId } from "@/constants/tools";

/** Derived from the TOOLS registry in constants/tools.ts — adding a tool there updates it. */
export type { ToolId };

/** Top-level grouping used by the tools-page filter. */
export type ToolCategory =
  | "links"
  | "brand"
  | "effects"
  | "backgrounds"
  | "color"
  | "image"
  | "secrets"
  | "developer";

export interface ToolMeta {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly icon: LucideIcon;
  readonly category: ToolCategory;
}

export interface HistoryEntry {
  id: string;
  toolId: ToolId;
  /** Human-readable summary shown in the history list. */
  label: string;
  /** The generated link or payload. */
  value: string;
  createdAt: number;
}

export interface Preset<T = Record<string, unknown>> {
  id: string;
  name: string;
  values: T;
  createdAt: number;
}

export type QrErrorLevel = "L" | "M" | "Q" | "H";

/** Shape of the data modules. */
export type QrModuleStyle = "square" | "rounded" | "dots";
/** Shape of the three corner finder patterns ("eyes"). */
export type QrEyeStyle = "square" | "rounded" | "circle";

export interface QrGradient {
  type: "linear" | "radial";
  from: string;
  to: string;
  /** Angle in degrees for linear gradients. */
  angle: number;
}

export interface QrOptions {
  fgColor: string;
  bgColor: string;
  size: number;
  errorLevel: QrErrorLevel;
  /** Data URL of an uploaded logo to overlay at the center. */
  logoDataUrl?: string;
  /** Data-module shape. Defaults to "square". */
  moduleStyle?: QrModuleStyle;
  /** Finder-pattern shape. Defaults to "square". */
  eyeStyle?: QrEyeStyle;
  /** Optional separate color for the three eyes; falls back to the pattern fill. */
  eyeColor?: string;
  /** A gradient fill for the modules; null/undefined = solid `fgColor`. */
  gradient?: QrGradient | null;
  /** Drop the background fill so the QR sits on any surface. */
  transparent?: boolean;
  /** Quiet-zone width in modules. Defaults to 2. */
  margin?: number;
  /** Logo width as a fraction of the QR (0.12–0.3). Defaults to 0.22. */
  logoScale?: number;
}

export const DEFAULT_QR_OPTIONS: QrOptions = {
  fgColor: "#0a0a0a",
  bgColor: "#ffffff",
  size: 320,
  errorLevel: "M",
  moduleStyle: "square",
  eyeStyle: "square",
  gradient: null,
  transparent: false,
  margin: 2,
  logoScale: 0.22,
};

export interface SharePlatform {
  id: string;
  name: string;
  buildUrl: (url: string, text: string) => string;
}
