import type { ToolMeta } from "@/types";

export const TOOLS: ToolMeta[] = [
  {
    id: "universal",
    slug: "/universal",
    name: "Universal Link Generator",
    shortName: "Universal",
    tagline: "One form for every link type",
    description:
      "Pick a link type — WhatsApp, SMS, call, email, WiFi or plain URL — and the form morphs instantly. One tool, every protocol.",
    keywords: ["universal link generator", "link builder", "qr generator"],
    icon: "Sparkles",
  },
  {
    id: "whatsapp",
    slug: "/whatsapp",
    name: "WhatsApp Link Generator",
    shortName: "WhatsApp",
    tagline: "wa.me links with prefilled messages",
    description:
      "Create click-to-chat WhatsApp links with a prefilled message, format group invites, and bulk-generate links from a CSV of numbers.",
    keywords: ["whatsapp link generator", "wa.me", "click to chat", "whatsapp qr"],
    icon: "MessageCircle",
  },
  {
    id: "qr",
    slug: "/qr",
    name: "QR Code Generator",
    shortName: "QR Code",
    tagline: "Custom QR codes for anything",
    description:
      "Generate QR codes for URLs, text, phone numbers, email, WiFi networks and vCards. Customize colors, size, error correction and add your logo.",
    keywords: ["qr code generator", "wifi qr code", "custom qr code", "vcard qr"],
    icon: "QrCode",
  },
  {
    id: "share",
    slug: "/share",
    name: "Share Link Generator",
    shortName: "Share Links",
    tagline: "Social share links for every network",
    description:
      "Build share links for WhatsApp, Telegram, X, Facebook, LinkedIn, Reddit and email — plus a native share button for mobile.",
    keywords: ["share link generator", "social share links", "share button"],
    icon: "Share2",
  },
  {
    id: "sms",
    slug: "/sms",
    name: "SMS Link Generator",
    shortName: "SMS",
    tagline: "sms: links with prefilled text",
    description:
      "Create sms: links that open the messaging app with the number and message already filled in. Perfect for ads, posters and email signatures.",
    keywords: ["sms link generator", "sms link", "text message link"],
    icon: "MessageSquare",
  },
  {
    id: "tel",
    slug: "/tel",
    name: "Click-to-Call Link Generator",
    shortName: "Call",
    tagline: "tel: links that dial instantly",
    description:
      "Generate tel: links that start a phone call with one tap. Validate any international number with a built-in country picker.",
    keywords: ["tel link generator", "click to call", "phone link"],
    icon: "Phone",
  },
  {
    id: "email",
    slug: "/email",
    name: "Email Link Generator",
    shortName: "Email",
    tagline: "mailto: links with subject & body",
    description:
      "Compose mailto: links with subject, body, CC and BCC prefilled. Great for support buttons, signatures and landing pages.",
    keywords: ["mailto link generator", "email link", "mailto builder"],
    icon: "Mail",
  },
  {
    id: "vcard",
    slug: "/vcard",
    name: "vCard Generator",
    shortName: "vCard",
    tagline: "Digital business cards (.vcf + QR)",
    description:
      "Build a complete vCard 3.0 contact card, preview it live, download the .vcf file and share it as a scannable QR code.",
    keywords: ["vcard generator", "vcf file", "digital business card", "contact qr"],
    icon: "Contact",
  },
  {
    id: "utm",
    slug: "/utm",
    name: "UTM Link Builder",
    shortName: "UTM",
    tagline: "Campaign URLs you can track",
    description:
      "Append UTM parameters to any URL with handy presets for common channels. Keep your analytics clean and consistent.",
    keywords: ["utm builder", "utm link generator", "campaign url builder"],
    icon: "BarChart3",
  },
  {
    id: "password",
    slug: "/password",
    name: "Password Generator",
    shortName: "Password",
    tagline: "Strong passwords, passphrases & PINs",
    description:
      "Generate cryptographically secure passwords, memorable passphrases and PINs with live entropy and crack-time estimates. Passwords are never stored or logged.",
    keywords: [
      "password generator",
      "strong password",
      "passphrase generator",
      "random password",
      "pin generator",
    ],
    icon: "KeyRound",
  },
  {
    id: "hash",
    slug: "/hash",
    name: "Hash Generator",
    shortName: "Hash",
    tagline: "MD5, SHA & HMAC checksums",
    description:
      "Compute MD5, SHA-1, SHA-256, SHA-384, SHA-512 and CRC32 hashes of any text or file — with HMAC signing and checksum verification. Verify downloads and sign payloads in seconds.",
    keywords: [
      "hash generator",
      "sha256 generator",
      "md5 hash",
      "checksum calculator",
      "hmac generator",
      "file hash",
    ],
    icon: "Hash",
  },
  {
    id: "lorem",
    slug: "/lorem",
    name: "Lorem Ipsum Generator",
    shortName: "Lorem Ipsum",
    tagline: "Placeholder text, your way",
    description:
      "Generate lorem ipsum paragraphs, sentences or words with live word counts — as plain text, HTML or Markdown, with optional bold, italic and link markup for testing rich layouts.",
    keywords: [
      "lorem ipsum generator",
      "placeholder text",
      "dummy text generator",
      "filler text",
      "lorem ipsum html",
    ],
    icon: "Type",
  },
  {
    id: "readtime",
    slug: "/reading-time",
    name: "Reading Time Calculator",
    shortName: "Reading Time",
    tagline: "“X min read” for any text",
    description:
      "Paste any text to get reading and speaking time at adjustable speeds, full word and sentence stats, and a Flesch readability score — with Medium-style image time included.",
    keywords: [
      "reading time calculator",
      "read time estimator",
      "words per minute",
      "speaking time calculator",
      "readability score",
    ],
    icon: "BookOpen",
  },
  {
    id: "mockup",
    slug: "/mockup",
    name: "Mockup Generator",
    shortName: "Mockup",
    tagline: "Device frames for shots & screen recordings",
    description:
      "Wrap screenshots, videos and live screen captures in browser, window or phone frames — with gradient backdrops, tilt, shadows and captions. Export social-ready PNGs or WebM video, all composed on-device.",
    keywords: [
      "mockup generator",
      "screenshot mockup",
      "device frame",
      "browser frame screenshot",
      "video mockup",
      "screen recording frame",
    ],
    icon: "Frame",
  },
  {
    id: "favicon",
    slug: "/favicon",
    name: "Favicon Generator",
    shortName: "Favicon",
    tagline: "One image → a complete favicon package",
    description:
      "Turn any image into a full favicon set — favicon.ico, PNGs for every platform, Apple touch icon, web manifest and paste-ready HTML — then download it all as a ZIP. Includes setup steps for HTML, Next.js, Vite, Nuxt and WordPress.",
    keywords: [
      "favicon generator",
      "favicon.ico generator",
      "apple touch icon",
      "web app manifest",
      "favicon package",
    ],
    icon: "Sparkle",
  },
];

export const TOOL_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<
  ToolMeta["id"],
  ToolMeta
>;
