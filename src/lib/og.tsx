import { ImageResponse } from "next/og";
import { TM_GLYPHS } from "@/components/shared/logo";

export const OG_SIZE = { width: 1200, height: 630 };

/** Shared OG image design — dark, minimal, brand-consistent. */
export function renderOgImage(title: string, subtitle: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "linear-gradient(135deg, #09090b 0%, #18181b 100%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <svg width="272" height="48" viewBox="12 22 896 158" fill="#fafafa">
            {TM_GLYPHS}
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 1000 }}>
            {title}
          </div>
          <div style={{ fontSize: 34, color: "#a1a1aa", maxWidth: 950 }}>{subtitle}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#71717a" }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#34d399" }} />
          Form follows function. · Free · No sign-up · No tracking
        </div>
      </div>
    ),
    OG_SIZE
  );
}
