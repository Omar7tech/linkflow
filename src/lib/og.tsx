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
            <rect width="32" height="32" rx="8" fill="#fafafa" />
            <path
              d="M10 24 V14.5 A6.5 6.5 0 0 1 16.5 8 H22"
              fill="none"
              stroke="#10150f"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <circle cx="20.75" cy="20.75" r="3.4" fill="#10b981" />
          </svg>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>
            forma<span style={{ color: "#34d399" }}>.</span>
          </div>
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
