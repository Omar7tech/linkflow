/**
 * Pure link builders — one function per protocol.
 * All functions are side-effect free and safe to unit test.
 */

import type { SharePlatform } from "@/types";

/** Strip everything except digits (keeps a leading + out — wa.me wants bare digits). */
export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

export function buildWhatsAppLink(phone: string, message?: string): string {
  const base = `https://wa.me/${digitsOnly(phone)}`;
  return message?.trim() ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Message-only link — the recipient picks a contact after opening WhatsApp. */
export function buildWhatsAppMessageLink(message: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

/** Accepts a full invite URL or just the code and returns a canonical invite link. */
export function formatWhatsAppGroupInvite(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/(?:chat\.whatsapp\.com\/)?(?:invite\/)?([A-Za-z0-9]{10,})\/?$/);
  const code = match?.[1] ?? trimmed;
  return `https://chat.whatsapp.com/${code}`;
}

// ---------------------------------------------------------------------------
// SMS / Tel
// ---------------------------------------------------------------------------

export function buildSmsLink(phone: string, body?: string): string {
  const base = `sms:${phone.replace(/[^\d+]/g, "")}`;
  return body?.trim() ? `${base}?body=${encodeURIComponent(body)}` : base;
}

export function buildTelLink(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export interface MailtoFields {
  to: string;
  subject?: string;
  body?: string;
  cc?: string;
  bcc?: string;
}

export function buildMailtoLink({ to, subject, body, cc, bcc }: MailtoFields): string {
  const params = new URLSearchParams();
  if (subject?.trim()) params.set("subject", subject);
  if (body?.trim()) params.set("body", body);
  if (cc?.trim()) params.set("cc", cc);
  if (bcc?.trim()) params.set("bcc", bcc);
  // URLSearchParams encodes spaces as "+", which mail clients render literally.
  const query = params.toString().replace(/\+/g, "%20");
  return `mailto:${to}${query ? `?${query}` : ""}`;
}

// ---------------------------------------------------------------------------
// vCard 3.0
// ---------------------------------------------------------------------------

export interface VCardFields {
  firstName: string;
  lastName?: string;
  organization?: string;
  jobTitle?: string;
  phoneMobile?: string;
  phoneWork?: string;
  email?: string;
  website?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  note?: string;
}

/** Escape per RFC 2426: backslash, semicolon, comma, newline. */
function vEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildVCard(fields: VCardFields): string {
  const e = (s?: string) => vEscape(s?.trim() ?? "");
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];

  lines.push(`N:${e(fields.lastName)};${e(fields.firstName)};;;`);
  lines.push(`FN:${[fields.firstName, fields.lastName].filter(Boolean).join(" ").trim()}`);

  if (fields.organization?.trim()) lines.push(`ORG:${e(fields.organization)}`);
  if (fields.jobTitle?.trim()) lines.push(`TITLE:${e(fields.jobTitle)}`);
  if (fields.phoneMobile?.trim()) lines.push(`TEL;TYPE=CELL:${fields.phoneMobile.trim()}`);
  if (fields.phoneWork?.trim()) lines.push(`TEL;TYPE=WORK,VOICE:${fields.phoneWork.trim()}`);
  if (fields.email?.trim()) lines.push(`EMAIL;TYPE=INTERNET:${fields.email.trim()}`);
  if (fields.website?.trim()) lines.push(`URL:${fields.website.trim()}`);

  const hasAddress = [fields.street, fields.city, fields.state, fields.zip, fields.country].some(
    (p) => p?.trim()
  );
  if (hasAddress) {
    lines.push(
      `ADR;TYPE=WORK:;;${e(fields.street)};${e(fields.city)};${e(fields.state)};${e(fields.zip)};${e(fields.country)}`
    );
  }
  if (fields.note?.trim()) lines.push(`NOTE:${e(fields.note)}`);

  lines.push("END:VCARD");
  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// WiFi QR payload
// ---------------------------------------------------------------------------

export interface WifiFields {
  ssid: string;
  password?: string;
  encryption: "WPA" | "WEP" | "nopass";
  hidden?: boolean;
}

/** Escape per the WiFi QR spec: backslash, semicolon, comma, colon, quote. */
function wifiEscape(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

export function buildWifiPayload({ ssid, password, encryption, hidden }: WifiFields): string {
  const parts = [`T:${encryption}`, `S:${wifiEscape(ssid)}`];
  if (encryption !== "nopass" && password) parts.push(`P:${wifiEscape(password)}`);
  if (hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}

// ---------------------------------------------------------------------------
// UTM
// ---------------------------------------------------------------------------

export interface UtmFields {
  url: string;
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
}

export function buildUtmUrl(fields: UtmFields): string {
  const url = new URL(fields.url);
  url.searchParams.set("utm_source", fields.source.trim());
  url.searchParams.set("utm_medium", fields.medium.trim());
  url.searchParams.set("utm_campaign", fields.campaign.trim());
  if (fields.term?.trim()) url.searchParams.set("utm_term", fields.term.trim());
  if (fields.content?.trim()) url.searchParams.set("utm_content", fields.content.trim());
  return url.toString();
}

// ---------------------------------------------------------------------------
// Social share links
// ---------------------------------------------------------------------------

export const SHARE_PLATFORMS: SharePlatform[] = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    buildUrl: (url, text) =>
      `https://api.whatsapp.com/send?text=${encodeURIComponent(text ? `${text} ${url}` : url)}`,
  },
  {
    id: "telegram",
    name: "Telegram",
    buildUrl: (url, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}${text ? `&text=${encodeURIComponent(text)}` : ""}`,
  },
  {
    id: "x",
    name: "X (Twitter)",
    buildUrl: (url, text) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}${text ? `&text=${encodeURIComponent(text)}` : ""}`,
  },
  {
    id: "facebook",
    name: "Facebook",
    buildUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    buildUrl: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: "reddit",
    name: "Reddit",
    buildUrl: (url, text) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}${text ? `&title=${encodeURIComponent(text)}` : ""}`,
  },
  {
    id: "email",
    name: "Email",
    buildUrl: (url, text) =>
      `mailto:?subject=${encodeURIComponent(text || "Check this out")}&body=${encodeURIComponent(url)}`,
  },
];
