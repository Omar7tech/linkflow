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

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.6'],
  reactCompiler: true,
  async redirects() {
    return MOVED_TOOL_SLUGS.map((slug) => ({
      source: `/${slug}`,
      destination: `/tools/${slug}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
