export type ToolId =
  | "whatsapp"
  | "qr"
  | "share"
  | "sms"
  | "tel"
  | "email"
  | "vcard"
  | "universal"
  | "utm"
  | "password";

export interface ToolMeta {
  id: ToolId;
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  keywords: string[];
  /** Lucide icon name — resolved in the tool registry component map. */
  icon: string;
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
