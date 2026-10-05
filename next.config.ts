import type { NextConfig } from "next";

/** Tool routes moved from /<slug> to /tools/<slug> — keep old links working. */
const MOVED_TOOL_SLUGS = [
  "universal",
  "whatsapp",
  "qr",
  "share",
  "sms",
  "tel",
  "email",
  "vcard",
  "utm",
  "password",
  "hash",
  "lorem",
  "reading-time",
  "mockup",
  "favicon",
  "json-csv",
  "image-splitter",
  "colors",
];

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
    return MOVED_TOOL_SLUGS.map((slug) => ({
      source: `/${slug}`,
      destination: `/tools/${slug}`,
      permanent: true,
    }));
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
