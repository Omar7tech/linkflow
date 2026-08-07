export type AuditCategory = "seo" | "accessibility" | "security" | "performance" | "content";
export type AuditStatus = "critical" | "warning" | "passed";

export interface AuditCheck {
  id: string;
  category: AuditCategory;
  status: AuditStatus;
  title: string;
  summary: string;
  fix?: string;
}

export interface AuditCategoryScore {
  id: AuditCategory;
  label: string;
  score: number;
}

export interface LaunchReadyResult {
  site: {
    url: string;
    host: string;
    title: string | null;
    description: string | null;
    faviconUrl: string;
    status: number;
    responseMs: number;
    pageKb: number;
  };
  score: number;
  verdict: string;
  categories: AuditCategoryScore[];
  checks: AuditCheck[];
  facts: {
    headings: number;
    images: number;
    links: number;
    scripts: number;
  };
  services: {
    pagespeed: "available" | "unavailable";
    observatory: "available" | "unavailable";
    validator: "available" | "unavailable";
  };
  scannedAt: string;
}

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  seo: "Search",
  accessibility: "Access",
  security: "Trust",
  performance: "Speed",
  content: "Content",
};

