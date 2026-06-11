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
          <svg width="64" height="64" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="9.6" fill="#fafafa" />
            <g
              transform="rotate(-30 16 16)"
              fill="none"
              stroke="#10150f"
              strokeWidth="2.4"
            >
              <rect x="5.4" y="13.1" width="12.2" height="5.8" rx="2.9" />
              <rect x="14.4" y="13.1" width="12.2" height="5.8" rx="2.9" />
            </g>
          </svg>
          <div style={{ fontSize: 40, fontWeight: 700 }}>linkflow</div>
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
