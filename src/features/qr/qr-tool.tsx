"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SparklesIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { qrScanWarning } from "@/lib/qr";
import { cn } from "@/lib/utils";
import {
  DEFAULT_QR_OPTIONS,
  type QrErrorLevel,
  type QrEyeStyle,
  type QrModuleStyle,
  type QrOptions,
} from "@/types";

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

const MODULE_STYLES: { id: QrModuleStyle; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "dots", label: "Dots" },
];

const EYE_STYLES: { id: QrEyeStyle; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "circle", label: "Circle" },
];

/** One-tap looks, kept on-brand (emerald + neutral). */
const STYLE_PRESETS: { name: string; options: Partial<QrOptions> }[] = [
  {
    name: "Classic",
    options: { moduleStyle: "square", eyeStyle: "square", fgColor: "#0a0a0a", gradient: null, eyeColor: undefined },
  },
  {
    name: "Rounded",
    options: { moduleStyle: "rounded", eyeStyle: "rounded", fgColor: "#0a0a0a", gradient: null, eyeColor: undefined },
  },
  {
    name: "Emerald dots",
    options: { moduleStyle: "dots", eyeStyle: "circle", fgColor: "#059669", gradient: null, eyeColor: undefined },
  },
  {
    name: "Emerald fade",
    options: {
      moduleStyle: "dots",
      eyeStyle: "circle",
      gradient: { type: "linear", from: "#10b981", to: "#047857", angle: 45 },
      eyeColor: "#065f46",
    },
  },
  {
    name: "Forest",
    options: {
      moduleStyle: "rounded",
      eyeStyle: "rounded",
      gradient: { type: "radial", from: "#34d399", to: "#065f46", angle: 0 },
      eyeColor: undefined,
    },
  },
];

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

  const isGradient = !!options.gradient;
  const eyeMatch = !options.eyeColor;
  const scanWarning = qrScanWarning(options);
  const toggleGradient = (on: boolean) =>
    patch({
      gradient: on
        ? { type: "linear", from: options.fgColor, to: "#047857", angle: 45 }
        : null,
    });

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
                <Textarea id="qr-text" rows={4} placeholder="FORMA-2026-PROMO" value={text} onChange={(e) => setText(e.target.value)} />
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
            <CardDescription>Shape the modules, fill, eyes and logo — every change is live.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Presets */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <SparklesIcon className="text-primary size-3.5" /> Presets
              </Label>
              <div className="flex flex-wrap gap-2">
                {STYLE_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => patch(p.options)}
                    className="border-border hover:bg-muted rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Pattern fill: solid or gradient */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label>Pattern fill</Label>
                <div className="bg-muted/60 inline-flex rounded-md p-0.5">
                  <Seg active={!isGradient} onClick={() => toggleGradient(false)}>
                    Solid
                  </Seg>
                  <Seg active={isGradient} onClick={() => toggleGradient(true)}>
                    Gradient
                  </Seg>
                </div>
              </div>

              {!isGradient ? (
                <ColorInput id="qr-fg" value={options.fgColor} onChange={(v) => patch({ fgColor: v })} />
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <ColorInput
                      id="qr-g1"
                      value={options.gradient!.from}
                      onChange={(v) => patch({ gradient: { ...options.gradient!, from: v } })}
                    />
                    <ColorInput
                      id="qr-g2"
                      value={options.gradient!.to}
                      onChange={(v) => patch({ gradient: { ...options.gradient!, to: v } })}
                    />
                  </div>
                  <div className="grid grid-cols-2 items-end gap-3">
                    <Field label="Type" htmlFor="qr-gtype">
                      <Select
                        value={options.gradient!.type}
                        onValueChange={(v) =>
                          patch({ gradient: { ...options.gradient!, type: v as "linear" | "radial" } })
                        }
                      >
                        <SelectTrigger id="qr-gtype" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="linear">Linear</SelectItem>
                          <SelectItem value="radial">Radial</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    {options.gradient!.type === "linear" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Angle</Label>
                          <span className="text-muted-foreground font-mono text-xs">
                            {options.gradient!.angle}°
                          </span>
                        </div>
                        <Slider
                          min={0}
                          max={360}
                          step={15}
                          value={[options.gradient!.angle]}
                          onValueChange={([v]) => patch({ gradient: { ...options.gradient!, angle: v } })}
                          aria-label="Gradient angle"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Background */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="qr-bg">Background</Label>
                <ColorInput
                  id="qr-bg"
                  value={options.bgColor}
                  onChange={(v) => patch({ bgColor: v })}
                  disabled={options.transparent}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 pt-6">
                <Switch
                  checked={!!options.transparent}
                  onCheckedChange={(v) => patch({ transparent: v })}
                  aria-label="Transparent background"
                />
                <span className="text-sm">Transparent</span>
              </label>
            </div>

            {/* Shapes */}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Module shape" htmlFor="qr-mod">
                <Select
                  value={options.moduleStyle ?? "square"}
                  onValueChange={(v) => patch({ moduleStyle: v as QrModuleStyle })}
                >
                  <SelectTrigger id="qr-mod" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODULE_STYLES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Eye shape" htmlFor="qr-eye">
                <Select
                  value={options.eyeStyle ?? "square"}
                  onValueChange={(v) => patch({ eyeStyle: v as QrEyeStyle })}
                >
                  <SelectTrigger id="qr-eye" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EYE_STYLES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* Eye color */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Eye color</Label>
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Match pattern</span>
                  <Switch
                    checked={eyeMatch}
                    onCheckedChange={(on) => patch({ eyeColor: on ? undefined : options.fgColor })}
                    aria-label="Match eye color to pattern"
                  />
                </label>
              </div>
              {!eyeMatch && (
                <ColorInput
                  id="qr-eyecolor"
                  value={options.eyeColor ?? options.fgColor}
                  onChange={(v) => patch({ eyeColor: v })}
                />
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
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
              <Field label={`Quiet zone — ${options.margin ?? 2}`} htmlFor="qr-margin">
                <Slider
                  id="qr-margin"
                  min={0}
                  max={6}
                  step={1}
                  value={[options.margin ?? 2]}
                  onValueChange={([v]) => patch({ margin: v })}
                  aria-label="Quiet zone in modules"
                />
              </Field>
            </div>

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
            {options.logoDataUrl && (
              <Field label={`Logo size — ${Math.round((options.logoScale ?? 0.22) * 100)}%`} htmlFor="qr-logosize">
                <Slider
                  id="qr-logosize"
                  min={12}
                  max={30}
                  step={1}
                  value={[Math.round((options.logoScale ?? 0.22) * 100)]}
                  onValueChange={([v]) => patch({ logoScale: v / 100 })}
                  aria-label="Logo size"
                />
              </Field>
            )}

            {scanWarning && (
              <div className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-start gap-2 rounded-lg border p-3 text-xs">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                <span>{scanWarning}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

function Seg({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

function ColorInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", disabled && "pointer-events-none opacity-40")}>
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-border size-8 cursor-pointer rounded-lg border bg-transparent p-0.5"
      />
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}
