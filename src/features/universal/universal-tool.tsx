"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { OutputCard } from "@/components/shared/output-card";
import { PhoneInput } from "@/components/shared/phone-input";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import {
  buildMailtoLink,
  buildSmsLink,
  buildTelLink,
  buildWhatsAppLink,
  buildWifiPayload,
} from "@/lib/linkBuilders";
import { isValidPhone, lenientUrlSchema } from "@/lib/validators";

type UniversalType = "whatsapp" | "sms" | "tel" | "email" | "url" | "wifi";

const TYPE_OPTIONS: { id: UniversalType; label: string; snippet: string }[] = [
  { id: "whatsapp", label: "WhatsApp chat", snippet: "Chat on WhatsApp" },
  { id: "sms", label: "SMS message", snippet: "Text us" },
  { id: "tel", label: "Phone call", snippet: "Call us" },
  { id: "email", label: "Email", snippet: "Email us" },
  { id: "url", label: "Website URL", snippet: "Visit site" },
  { id: "wifi", label: "WiFi access", snippet: "Connect to WiFi" },
];

export function UniversalTool() {
  const history = useHistory("universal");
  const [type, setType] = React.useState<UniversalType>("whatsapp");

  const [phone, setPhone] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [ssid, setSsid] = React.useState("");
  const [wifiPass, setWifiPass] = React.useState("");

  const needsPhone = type === "whatsapp" || type === "sms" || type === "tel";
  const phoneValid = isValidPhone(phone);
  const phoneError = phone && !phoneValid ? "Enter a valid phone number with country code" : undefined;

  let output: string | null = null;
  switch (type) {
    case "whatsapp":
      output = phoneValid ? buildWhatsAppLink(phone, message) : null;
      break;
    case "sms":
      output = phoneValid ? buildSmsLink(phone, message) : null;
      break;
    case "tel":
      output = phoneValid ? buildTelLink(phone) : null;
      break;
    case "email": {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      output = ok ? buildMailtoLink({ to: email, subject, body: message }) : null;
      break;
    }
    case "url": {
      const parsed = url.trim() ? lenientUrlSchema.safeParse(url) : null;
      output = parsed?.success ? parsed.data : null;
      break;
    }
    case "wifi":
      output = ssid.trim()
        ? buildWifiPayload({ ssid, password: wifiPass, encryption: wifiPass ? "WPA" : "nopass" })
        : null;
      break;
  }

  const selected = TYPE_OPTIONS.find((t) => t.id === type)!;
  const commit = () => {
    if (output) history.add(selected.label, output);
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.universal}
      output={
        <OutputCard
          output={output}
          snippetLabel={selected.snippet}
          onAction={commit}
          filename={`linkflow-${type}`}
          openable={type !== "wifi"}
          showSnippets={type !== "wifi"}
          emptyHint="Pick a type, fill the short form, get your link."
        />
      }
      footer={<HistoryPanel history={history} />}
    >
      <Card>
        <CardContent className="space-y-5">
          <Field label="What do you want to create?" htmlFor="uni-type">
            <Select value={type} onValueChange={(v) => setType(v as UniversalType)}>
              <SelectTrigger id="uni-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {needsPhone && (
            <Field label="Phone number" htmlFor="uni-phone" error={phoneError}>
              <PhoneInput id="uni-phone" value={phone} onChange={setPhone} />
            </Field>
          )}

          {(type === "whatsapp" || type === "sms") && (
            <Field label="Prefilled message" htmlFor="uni-message" optional>
              <Textarea
                id="uni-message"
                rows={3}
                placeholder="Hi! I found you through…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </Field>
          )}

          {type === "email" && (
            <>
              <Field label="Email address" htmlFor="uni-email">
                <Input id="uni-email" type="email" placeholder="hello@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Subject" htmlFor="uni-subject" optional>
                <Input id="uni-subject" placeholder="Hello!" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </Field>
              <Field label="Body" htmlFor="uni-body" optional>
                <Textarea id="uni-body" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
              </Field>
            </>
          )}

          {type === "url" && (
            <Field label="URL" htmlFor="uni-url" hint="We'll add https:// if you skip it.">
              <Input id="uni-url" inputMode="url" placeholder="example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
          )}

          {type === "wifi" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Network name" htmlFor="uni-ssid">
                <Input id="uni-ssid" placeholder="Home_WiFi" value={ssid} onChange={(e) => setSsid(e.target.value)} />
              </Field>
              <Field label="Password" htmlFor="uni-pass" optional hint="Leave empty for open networks.">
                <Input id="uni-pass" autoComplete="off" placeholder="••••••••" value={wifiPass} onChange={(e) => setWifiPass(e.target.value)} />
              </Field>
            </div>
          )}
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}
