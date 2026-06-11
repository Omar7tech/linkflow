"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { XIcon } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { PhoneInput } from "@/components/shared/phone-input";
import { QrPreview } from "@/components/shared/qr-preview";
import { CopyButton } from "@/components/shared/copy-button";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import {
  buildMailtoLink,
  buildTelLink,
  buildVCard,
  buildWifiPayload,
} from "@/lib/linkBuilders";
import { lenientUrlSchema, wifiSchema } from "@/lib/validators";
import { DEFAULT_QR_OPTIONS, type QrErrorLevel, type QrOptions } from "@/types";

type QrType = "url" | "text" | "phone" | "email" | "wifi" | "vcard";

const QR_TYPES: { id: QrType; label: string }[] = [
  { id: "url", label: "URL" },
  { id: "text", label: "Text" },
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
  { id: "wifi", label: "WiFi" },
  { id: "vcard", label: "vCard" },
];

const wifiFormSchema = wifiSchema;
type WifiValues = z.infer<typeof wifiFormSchema>;

export function QrTool() {
  const history = useHistory("qr");
  const [type, setType] = React.useState<QrType>("url");

  // Per-type inputs (kept simple and controlled).
  const [url, setUrl] = React.useState("");
  const [text, setText] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [emailSubject, setEmailSubject] = React.useState("");
  const [contact, setContact] = React.useState({ firstName: "", lastName: "", phone: "", email: "", organization: "" });

  const wifiForm = useForm<WifiValues>({
    resolver: zodResolver(wifiFormSchema),
    defaultValues: { ssid: "", password: "", encryption: "WPA", hidden: false },
    mode: "onTouched",
  });
  const wifi = useWatch({ control: wifiForm.control }) as WifiValues;

  // Customization.
  const [options, setOptions] = React.useState<QrOptions>(DEFAULT_QR_OPTIONS);
  const patch = (p: Partial<QrOptions>) => setOptions((prev) => ({ ...prev, ...p }));

  const onLogoUpload = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      patch({ logoDataUrl: reader.result as string, errorLevel: "H" });
      toast.info("Error correction raised to High so the logo stays scannable");
    };
    reader.readAsDataURL(file);
  };

  let payload = "";
  let payloadError: string | null = null;
  switch (type) {
    case "url": {
      if (url.trim()) {
        const parsed = lenientUrlSchema.safeParse(url);
        if (parsed.success) payload = parsed.data;
        else payloadError = "Enter a valid URL";
      }
      break;
    }
    case "text":
      payload = text.trim();
      break;
    case "phone":
      payload = phone.trim() ? buildTelLink(phone) : "";
      break;
    case "email":
      payload = email.trim()
        ? buildMailtoLink({ to: email, subject: emailSubject })
        : "";
      break;
    case "wifi":
      payload = wifi.ssid.trim() ? buildWifiPayload(wifi) : "";
      break;
    case "vcard":
      payload = contact.firstName.trim()
        ? buildVCard({
            firstName: contact.firstName,
            lastName: contact.lastName,
            phoneMobile: contact.phone,
            email: contact.email,
            organization: contact.organization,
          })
        : "";
      break;
  }

  const commit = () => {
    if (payload) history.add(`${QR_TYPES.find((t) => t.id === type)?.label} QR`, payload);
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.qr}
      output={
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle className="text-base">Live preview</CardTitle>
            <CardDescription>
              {payload
                ? "Scan it with your camera to test, then download."
                : payloadError ?? "Your QR code renders here as you type."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <QrPreview
              value={payload}
              options={options}
              filename={`qr-${type}`}
              onAction={commit}
              className="mx-auto"
            />
            {payload && (
              <div className="bg-muted/50 border-border rounded-lg border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">Encoded data</span>
                  <CopyButton text={payload} label="" variant="ghost" size="icon-xs" onCopied={commit} aria-label="Copy encoded data" />
                </div>
                <code className="block max-h-24 overflow-auto font-mono text-xs break-all whitespace-pre-wrap">
                  {payload}
                </code>
              </div>
            )}
          </CardContent>
        </Card>
      }
      footer={<HistoryPanel history={history} />}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content</CardTitle>
            <CardDescription>What should the QR code contain?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Type" htmlFor="qr-type">
              <Select value={type} onValueChange={(v) => setType(v as QrType)}>
                <SelectTrigger id="qr-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QR_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {type === "url" && (
              <Field label="URL" htmlFor="qr-url" error={payloadError ?? undefined} hint="Bare domains work — https:// is added automatically.">
                <Input id="qr-url" inputMode="url" placeholder="example.com/menu" value={url} onChange={(e) => setUrl(e.target.value)} />
              </Field>
            )}
            {type === "text" && (
              <Field label="Text" htmlFor="qr-text" hint="Any free text — notes, serial numbers, coupon codes.">
                <Textarea id="qr-text" rows={4} placeholder="LINKFLOW-2026-PROMO" value={text} onChange={(e) => setText(e.target.value)} />
              </Field>
            )}
            {type === "phone" && (
              <Field label="Phone number" htmlFor="qr-phone" hint="Scanning starts a call to this number.">
                <PhoneInput id="qr-phone" value={phone} onChange={setPhone} />
              </Field>
            )}
            {type === "email" && (
              <>
                <Field label="Email address" htmlFor="qr-email">
                  <Input id="qr-email" type="email" placeholder="hello@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Subject" htmlFor="qr-email-subject" optional>
                  <Input id="qr-email-subject" placeholder="Inquiry" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                </Field>
              </>
            )}
            {type === "wifi" && (
              <>
                <Field label="Network name (SSID)" htmlFor="qr-ssid" error={wifiForm.formState.errors.ssid?.message}>
                  <Input id="qr-ssid" placeholder="CoffeeShop_Guest" {...wifiForm.register("ssid")} />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Security" htmlFor="qr-encryption">
                    <Controller
                      control={wifiForm.control}
                      name="encryption"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="qr-encryption" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WPA">WPA / WPA2 / WPA3</SelectItem>
                            <SelectItem value="WEP">WEP (legacy)</SelectItem>
                            <SelectItem value="nopass">Open network</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  {wifi.encryption !== "nopass" && (
                    <Field label="Password" htmlFor="qr-wifi-pass">
                      <Input id="qr-wifi-pass" type="text" autoComplete="off" placeholder="••••••••" {...wifiForm.register("password")} />
                    </Field>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <Controller
                    control={wifiForm.control}
                    name="hidden"
                    render={({ field }) => (
                      <Switch id="qr-hidden" checked={!!field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                  <label htmlFor="qr-hidden" className="text-sm">
                    Hidden network
                  </label>
                </div>
              </>
            )}
            {type === "vcard" && (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="First name" htmlFor="qr-vc-first">
                    <Input id="qr-vc-first" placeholder="Maya" value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} />
                  </Field>
                  <Field label="Last name" htmlFor="qr-vc-last" optional>
                    <Input id="qr-vc-last" placeholder="Haddad" value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} />
                  </Field>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Phone" htmlFor="qr-vc-phone" optional>
                    <PhoneInput id="qr-vc-phone" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} />
                  </Field>
                  <Field label="Email" htmlFor="qr-vc-email" optional>
                    <Input id="qr-vc-email" type="email" placeholder="maya@acme.com" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                  </Field>
                </div>
                <Field label="Company" htmlFor="qr-vc-org" optional hint="Need more fields? Use the full vCard tool.">
                  <Input id="qr-vc-org" placeholder="Acme Inc." value={contact.organization} onChange={(e) => setContact({ ...contact, organization: e.target.value })} />
                </Field>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Design</CardTitle>
            <CardDescription>Colors, size, error correction and logo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Foreground" htmlFor="qr-fg">
                <div className="flex items-center gap-2">
                  <input
                    id="qr-fg"
                    type="color"
                    value={options.fgColor}
                    onChange={(e) => patch({ fgColor: e.target.value })}
                    className="border-border size-8 cursor-pointer rounded-lg border bg-transparent p-0.5"
                  />
                  <span className="font-mono text-xs">{options.fgColor}</span>
                </div>
              </Field>
              <Field label="Background" htmlFor="qr-bg">
                <div className="flex items-center gap-2">
                  <input
                    id="qr-bg"
                    type="color"
                    value={options.bgColor}
                    onChange={(e) => patch({ bgColor: e.target.value })}
                    className="border-border size-8 cursor-pointer rounded-lg border bg-transparent p-0.5"
                  />
                  <span className="font-mono text-xs">{options.bgColor}</span>
                </div>
              </Field>
            </div>

            <Field label={`Size — ${options.size}px`} htmlFor="qr-size">
              <Slider
                id="qr-size"
                min={128}
                max={1024}
                step={32}
                value={[options.size]}
                onValueChange={([v]) => patch({ size: v })}
                aria-label="QR size in pixels"
              />
            </Field>

            <Field
              label="Error correction"
              htmlFor="qr-ec"
              hint="Higher levels survive more damage (and logos) but pack denser modules."
            >
              <Select
                value={options.errorLevel}
                onValueChange={(v) => patch({ errorLevel: v as QrErrorLevel })}
              >
                <SelectTrigger id="qr-ec" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Low — 7%</SelectItem>
                  <SelectItem value="M">Medium — 15%</SelectItem>
                  <SelectItem value="Q">Quartile — 25%</SelectItem>
                  <SelectItem value="H">High — 30%</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Logo overlay" htmlFor="qr-logo" optional hint="PNG or SVG with a transparent background works best.">
              <div className="flex items-center gap-2">
                <Input
                  id="qr-logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => onLogoUpload(e.target.files?.[0])}
                  className="flex-1"
                />
                {options.logoDataUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove logo"
                    onClick={() => patch({ logoDataUrl: undefined })}
                  >
                    <XIcon />
                  </Button>
                )}
              </div>
            </Field>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}
