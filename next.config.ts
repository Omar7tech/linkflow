import type { NextConfig } from "next";

/** Tool routes moved from /<slug> to /tools/<slug> — keep old links working. */
const MOVED_TOOL_SLUGS = [
  "universal",
  "whatsapp",
  "qr",
  "share",
  "tel",
  "vcard",
  "utm",
  "password",
  "hash",
  "lorem",
  "mockup",
  "favicon",
  "json-csv",
  "image-splitter",
  "colors",
];

/**
 * Tools that were folded into another tool, moved out of /tools, or retired.
 * Each old address goes to wherever its job is done now.
 */
const RETIRED_TOOLS: Record<string, string> = {
  // Folded into the share-link generator, opening on the right tab.
  sms: "/tools/share?mode=sms",
  email: "/tools/share?mode=email",
  // Three photo tools became one.
  duotone: "/tools/photo-effects?mode=duotone",
  halftone: "/tools/photo-effects?mode=halftone",
  "filter-lab": "/tools/photo-effects",
  // The link preview is a tab of the OG image studio.
  "social-preview": "/tools/og-image?mode=preview",
  // Moved to /experiments.
  "magic-eye": "/experiments/magic-eye",
  "audio-secrets": "/experiments/audio-secrets",
  "sorting-visualizer": "/experiments/sorting-visualizer",
  "pathfinding-visualizer": "/experiments/pathfinding-visualizer",
  // Retired: the nearest tool that is still here.
  neumorphism: "/tools/material-forge",
  "brand-personality": "/tools/theme-foundry",
  "reading-time": "/tools",
  slugify: "/tools",
};

/**
 * Vercel sizes its build containers honestly; shared hosts (Hostinger) report
 * every core of the physical machine while capping the account at a fraction
 * of that, so Next's default of `cores - 1` build workers exhausts memory and
 * the build stalls. Off Vercel, keep the build small. BUILD_CPUS overrides.
 *
 * The same over-count hits the compile step: Turbopack runs the Babel React
 * Compiler in a pool of Node child processes sized by core count. A lean
 * build uses the native Rust compiler and worker threads instead, and skips
 * writing a build cache the host throws away.
 */
const IS_VERCEL = Boolean(process.env.VERCEL);
const BUILD_CPUS = Number(process.env.BUILD_CPUS) || (IS_VERCEL ? undefined : 2);
const LEAN_BUILD = !IS_VERCEL && process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.6'],
  reactCompiler: true,
  // Types are checked on every Vercel build and by `npm run typecheck`.
  typescript: { ignoreBuildErrors: !IS_VERCEL },
  experimental: {
    ...(BUILD_CPUS ? { cpus: BUILD_CPUS } : {}),
    serverSourceMaps: false,
    ...(LEAN_BUILD
      ? {
          turbopackRustReactCompiler: true,
          turbopackPluginRuntimeStrategy: "workerThreads" as const,
          turbopackFileSystemCacheForBuild: false,
        }
      : {}),
  },
  async redirects() {
    return [
      ...MOVED_TOOL_SLUGS.map((slug) => ({
        source: `/${slug}`,
        destination: `/tools/${slug}`,
        permanent: true,
      })),
      ...Object.entries(RETIRED_TOOLS).map(([slug, destination]) => ({
        source: `/tools/${slug}`,
        destination,
        permanent: true,
      })),
      // These three also had pre-/tools addresses.
      { source: "/sms", destination: RETIRED_TOOLS.sms, permanent: true },
      { source: "/email", destination: RETIRED_TOOLS.email, permanent: true },
      { source: "/reading-time", destination: RETIRED_TOOLS["reading-time"], permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
