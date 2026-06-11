import { ImageResponse } from "next/og";

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
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#fafafa",
              color: "#09090b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            ⛓
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>LinkFlow</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 1000 }}>
            {title}
          </div>
          <div style={{ fontSize: 34, color: "#a1a1aa", maxWidth: 950 }}>{subtitle}</div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#71717a" }}>
          Create, Share, Connect. · Free · No sign-up · 100% client-side
        </div>
      </div>
    ),
    OG_SIZE
  );
}
