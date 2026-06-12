import type { LucideIcon } from "lucide-react";
// Type-only circular import — erased at runtime, resolved lazily by TypeScript.
import type { ToolId } from "@/constants/tools";

/** Derived from the TOOLS registry in constants/tools.ts — adding a tool there updates it. */
export type { ToolId };

export interface ToolMeta {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly icon: LucideIcon;
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

export interface QrOptions {
  fgColor: string;
  bgColor: string;
  size: number;
  errorLevel: QrErrorLevel;
  /** Data URL of an uploaded logo to overlay at the center. */
  logoDataUrl?: string;
}

export const DEFAULT_QR_OPTIONS: QrOptions = {
  fgColor: "#000000",
  bgColor: "#ffffff",
  size: 320,
  errorLevel: "M",
};

export interface SharePlatform {
  id: string;
  name: string;
  buildUrl: (url: string, text: string) => string;
}
