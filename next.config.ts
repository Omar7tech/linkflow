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
 */
const IS_VERCEL = Boolean(process.env.VERCEL);
const BUILD_CPUS = Number(process.env.BUILD_CPUS) || (IS_VERCEL ? undefined : 2);

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.6'],
  reactCompiler: true,
  // Types are checked on every Vercel build and by `npm run typecheck`.
  typescript: { ignoreBuildErrors: !IS_VERCEL },
  experimental: {
    ...(BUILD_CPUS ? { cpus: BUILD_CPUS } : {}),
    serverSourceMaps: false,
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
