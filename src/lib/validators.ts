import { z } from "zod";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/** Validates an international phone number for the given (or any) country. */
export function isValidPhone(value: string, country?: CountryCode): boolean {
  const parsed = parsePhoneNumberFromString(value, country);
  return parsed?.isValid() ?? false;
}

/** A phone field validated with libphonenumber-js. Expects E.164 or national + country. */
export const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .refine((v) => isValidPhone(v), "Enter a valid phone number with country code");

export const optionalPhoneSchema = z
  .string()
  .refine((v) => v === "" || isValidPhone(v), "Enter a valid phone number with country code")
  .optional()
  .or(z.literal(""));

const urlWithProtocol = z.url({ message: "Enter a valid URL (https://…)" });

/** Accepts bare domains and prepends https:// before validating. */
export const lenientUrlSchema = z
  .string()
  .min(1, "URL is required")
  .transform((v) => (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v) ? v : `https://${v}`))
  .pipe(urlWithProtocol);

export const whatsappChatSchema = z.object({
  phone: phoneSchema,
  message: z.string().max(4096, "WhatsApp messages are limited to 4096 characters").optional(),
});

export const whatsappMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(4096),
});

export const whatsappGroupSchema = z.object({
  invite: z
    .string()
    .min(1, "Paste an invite link or code")
    .refine(
      (v) => /(?:chat\.whatsapp\.com\/)?(?:invite\/)?[A-Za-z0-9]{10,}\/?$/.test(v.trim()),
      "That doesn't look like a WhatsApp group invite"
    ),
});

export const smsSchema = z.object({
  phone: phoneSchema,
  body: z.string().max(1600, "Keep it under 1600 characters").optional(),
});

export const telSchema = z.object({
  phone: phoneSchema,
});

const emailList = z
  .string()
  .refine(
    (v) =>
      v === "" ||
      v
        .split(",")
        .every((part) => z.email().safeParse(part.trim()).success),
    "Enter valid email addresses, separated by commas"
  );

export const mailtoSchema = z.object({
  to: z
    .string()
    .min(1, "Recipient is required")
    .refine(
      (v) => v.split(",").every((part) => z.email().safeParse(part.trim()).success),
      "Enter valid email addresses, separated by commas"
    ),
  subject: z.string().max(255).optional(),
  body: z.string().max(10000).optional(),
  cc: emailList.optional(),
  bcc: emailList.optional(),
});

export const vcardSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  organization: z.string().optional(),
  jobTitle: z.string().optional(),
  phoneMobile: optionalPhoneSchema,
  phoneWork: optionalPhoneSchema,
  email: z.email("Enter a valid email").optional().or(z.literal("")),
  website: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  note: z.string().max(500).optional(),
});

export const utmSchema = z.object({
  url: lenientUrlSchema,
  source: z.string().min(1, "utm_source is required (e.g. google, newsletter)"),
  medium: z.string().min(1, "utm_medium is required (e.g. cpc, email)"),
  campaign: z.string().min(1, "utm_campaign is required (e.g. spring_sale)"),
  term: z.string().optional(),
  content: z.string().optional(),
});

export const shareSchema = z.object({
  url: lenientUrlSchema,
  text: z.string().max(500).optional(),
});

export const wifiSchema = z.object({
  ssid: z.string().min(1, "Network name (SSID) is required"),
  password: z.string().optional(),
  encryption: z.enum(["WPA", "WEP", "nopass"]),
  hidden: z.boolean().optional(),
});
