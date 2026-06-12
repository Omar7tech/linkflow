import type { ToolMeta } from "@/types";

export const TOOLS: ToolMeta[] = [
  {
    id: "universal",
    slug: "/universal",
    name: "Universal Link Generator",
    shortName: "Universal",
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
  {
    id: "jsoncsv",
    slug: "/json-csv",
    name: "JSON to CSV Converter",
    shortName: "JSON to CSV",
    description:
      "Transform nested JSON objects or arrays into flat, clean CSV files for Excel or Google Sheets. Features smart object flattening and instant preview.",
    keywords: ["json to csv", "json flattener", "json converter", "data transform"],
    icon: "FileSpreadsheet",
  },
  {
    id: "imagesplitter",
    slug: "/image-splitter",
    name: "Image Splitter",
    shortName: "Grid Splitter",
    description:
      "Split your images into perfect 3x1, 3x3, or custom grids for Instagram. Locally processed, high-quality slices ready for your profile.",
    keywords: ["image splitter", "instagram grid", "grid maker", "image slicer"],
    icon: "Grid3X3",
  },
  {
    id: "colors",
    slug: "/colors",
    name: "Image Color Extractor",
    shortName: "Color Extractor",
    description:
      "Upload an image to extract its dominant colors as a clean palette — copy any swatch as HEX, RGB or HSL, sort by frequency or hue, pick colors from your screen, and export to CSS, SCSS, JSON or Tailwind. All on-device.",
    keywords: [
      "color extractor",
      "image color picker",
      "palette generator",
      "dominant colors",
      "color palette from image",
    ],
    icon: "Palette",
  },
];

export const TOOL_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<
  ToolMeta["id"],
  ToolMeta
>;
