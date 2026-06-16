"use client";

import * as React from "react";
import {
  CheckIcon,
  GlobeIcon,
  MoreHorizontalIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { SITE } from "@/constants/site";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  buildMetaTags,
  clip,
  domainOf,
  isDataUri,
  metaScore,
  type SocialMeta,
} from "@/lib/social-preview";
import { cn } from "@/lib/utils";

const DEFAULT_META: SocialMeta = {
  title: "Forma — Free, Private Tools for Devs & Designers",
  description:
    "A lean studio of on-device generators for links, color, design and images. No sign-up, no uploads, no limits.",
  url: SITE.url,
  image: "",
  favicon: "",
  siteName: SITE.name,
  twitterHandle: SITE.twitter,
};

const PLATFORMS = [
  { id: "google", label: "Google" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "x", label: "X" },
  { id: "facebook", label: "Facebook" },
  { id: "slack", label: "Slack" },
  { id: "discord", label: "Discord" },
] as const;

const IDEAL_RATIO = 1200 / 630; // 1.905

/** Load an image to read its real dimensions, ignoring stale results. */
function useImageInfo(src: string) {
  const [info, setInfo] = React.useState<{ src: string; w: number; h: number } | null>(null);
  React.useEffect(() => {
    if (!src.trim()) return;
    let active = true;
    const img = new Image();
    img.onload = () => active && setInfo({ src, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => active && setInfo({ src, w: 0, h: 0 });
    img.src = src;
    return () => {
      active = false;
    };
  }, [src]);
  return info && info.src === src ? info : null;
}

export function SocialPreviewTool() {
  const [meta, setMeta] = React.useState<SocialMeta>(DEFAULT_META);
  // Uploaded OG image lives here (a data: URI) — preview-only, never persisted
  // or injected into the tags, since crawlers need a hosted URL.
  const [upload, setUpload] = React.useState("");

  const update =
    (key: keyof SocialMeta) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setMeta((m) => ({ ...m, [key]: e.target.value }));

  const readFile = (file: File | undefined, onResult: (dataUri: string) => void) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => onResult(reader.result as string);
    reader.readAsDataURL(file);
  };

  const domain = domainOf(meta.url);
  const siteName = meta.siteName.trim() || domain;
  // What the cards actually render: a pasted URL wins, else the upload.
  const previewImage = meta.image.trim() || upload;
  const cardMeta: SocialMeta = { ...meta, image: previewImage };
  const dims = useImageInfo(previewImage);
  const tags = buildMetaTags(meta);
  const { score, tips } = metaScore(meta);

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.socialpreview}
      output={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live unfurl preview</CardTitle>
            <CardDescription>Exactly how your link looks where it gets shared.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="google">
              <TabsList className="flex w-full flex-wrap">
                {PLATFORMS.map((p) => (
                  <TabsTrigger key={p.id} value={p.id} className="flex-1">
                    {p.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="google" className="pt-4">
                <GooglePreview meta={cardMeta} domain={domain} />
              </TabsContent>
              <TabsContent value="whatsapp" className="pt-4">
                <WhatsAppPreview meta={cardMeta} domain={domain} />
              </TabsContent>
              <TabsContent value="x" className="pt-4">
                <XPreview meta={cardMeta} domain={domain} />
              </TabsContent>
              <TabsContent value="facebook" className="pt-4">
                <FacebookPreview meta={cardMeta} domain={domain} siteName={siteName} />
              </TabsContent>
              <TabsContent value="slack" className="pt-4">
                <SlackPreview meta={cardMeta} siteName={siteName} />
              </TabsContent>
              <TabsContent value="discord" className="pt-4">
                <DiscordPreview meta={cardMeta} siteName={siteName} />
              </TabsContent>
            </Tabs>

            <p className="text-muted-foreground mt-4 flex items-start gap-2 text-xs">
              <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Everything renders on-device — uploads and image URLs stay in your browser, nothing is
              sent to us or the platforms.
            </p>
          </CardContent>
        </Card>
      }
      footer={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meta tags</CardTitle>
            <CardDescription>
              Paste into your page&apos;s <code className="font-mono">&lt;head&gt;</code> — covers
              Open Graph (Facebook, LinkedIn, Slack, Discord, WhatsApp) and Twitter/X cards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-muted/50 border-border max-h-72 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed">
                {tags}
              </pre>
              <CopyButton
                text={tags}
                label=""
                variant="ghost"
                size="icon-sm"
                className="absolute top-1.5 right-1.5"
                successMessage="Meta tags copied"
                aria-label="Copy meta tags"
              />
            </div>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4">
            <Field label="Title" hint={`${meta.title.length} chars`}>
              <Input value={meta.title} onChange={update("title")} placeholder="Your page title" />
            </Field>

            <Field label="Description" hint={`${meta.description.length} chars`}>
              <Textarea
                value={meta.description}
                onChange={update("description")}
                placeholder="A short, punchy summary of the page."
                rows={3}
                className="resize-none"
              />
            </Field>

            <Field label="Page URL">
              <Input value={meta.url} onChange={update("url")} placeholder="https://example.com/page" />
            </Field>

            {/* OG image — paste a hosted URL or upload one to preview. */}
            <Field label="Share image" hint="1200 × 630 · 1.91:1">
              <div className="flex gap-2">
                <Input
                  value={meta.image}
                  onChange={update("image")}
                  placeholder="https://example.com/og.png"
                />
                <UploadButton onFile={(f) => readFile(f, setUpload)} />
              </div>
              <ImageStatus
                hasUrl={!!meta.image.trim()}
                upload={upload}
                dims={dims}
                onClearUpload={() => setUpload("")}
              />
            </Field>

            {/* Favicon — small enough to embed inline, shown in the cards. */}
            <Field label="Favicon" hint="shown in Google, WhatsApp & Slack">
              <div className="flex gap-2">
                <Input
                  value={isDataUri(meta.favicon) ? "" : meta.favicon}
                  onChange={update("favicon")}
                  placeholder="https://example.com/favicon.ico"
                />
                <UploadButton onFile={(f) => readFile(f, (d) => setMeta((m) => ({ ...m, favicon: d }))) } />
              </div>
              {isDataUri(meta.favicon) && (
                <p className="text-muted-foreground flex items-center justify-between text-[11px]">
                  <span>Uploaded favicon — host it for the meta tag.</span>
                  <button
                    type="button"
                    className="hover:text-foreground underline"
                    onClick={() => setMeta((m) => ({ ...m, favicon: "" }))}
                  >
                    Remove
                  </button>
                </p>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Site name">
                <Input value={meta.siteName} onChange={update("siteName")} placeholder={domain} />
              </Field>
              <Field label="X / Twitter handle">
                <Input
                  value={meta.twitterHandle}
                  onChange={update("twitterHandle")}
                  placeholder="@handle"
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Completeness meter — nudges toward a card that actually converts. */}
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Share-readiness</span>
              <span className="text-sm font-semibold tabular-nums">{score}%</span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  score >= 80 ? "bg-primary" : score >= 50 ? "bg-amber-500" : "bg-destructive"
                )}
                style={{ width: `${score}%` }}
              />
            </div>
            {tips.length > 0 ? (
              <ul className="text-muted-foreground space-y-1 text-xs">
                {tips.map((t) => (
                  <li key={t} className="flex gap-1.5">
                    <span aria-hidden>•</span>
                    {t}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">
                Looking great — your link is ready to share everywhere.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

/* ------------------------------- shared bits ------------------------------ */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        {hint && <span className="text-muted-foreground text-[11px]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function UploadButton({ onFile }: { onFile: (file: File | undefined) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="icon" onClick={() => ref.current?.click()} title="Upload an image">
        <UploadIcon />
      </Button>
    </>
  );
}

function ImageStatus({
  hasUrl,
  upload,
  dims,
  onClearUpload,
}: {
  hasUrl: boolean;
  upload: string;
  dims: { w: number; h: number } | null;
  onClearUpload: () => void;
}) {
  const ratioOk = dims && dims.w > 0 && Math.abs(dims.w / dims.h - IDEAL_RATIO) < 0.12 && dims.w >= 600;

  return (
    <div className="space-y-1 text-[11px]">
      {dims && dims.w > 0 && (
        <p
          className={cn(
            "flex items-center gap-1.5",
            ratioOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-500"
          )}
        >
          {ratioOk ? <CheckIcon className="size-3" /> : <TriangleAlertIcon className="size-3" />}
          {dims.w} × {dims.h}
          {ratioOk ? " — perfect for share cards" : " — aim for 1200 × 630 (1.91:1)"}
        </p>
      )}
      {!hasUrl && upload && (
        <p className="text-muted-foreground flex items-center justify-between">
          <span>Shown in previews — host it and paste the URL for your meta tag.</span>
          <button type="button" className="hover:text-foreground underline" onClick={onClearUpload}>
            Remove
          </button>
        </p>
      )}
    </div>
  );
}

function Favicon({ src, className }: { src: string; className?: string }) {
  const [error, setError] = React.useState(false);
  if (!src.trim() || error) {
    return <GlobeIcon className={cn("text-muted-foreground", className)} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={src} src={src} alt="" onError={() => setError(true)} className={cn("object-cover", className)} />
  );
}

function PreviewImage({ src, className }: { src: string; className?: string }) {
  const [error, setError] = React.useState(false);
  if (!src.trim() || error) {
    return (
      <div
        className={cn(
          "from-muted to-muted-foreground/20 text-muted-foreground flex items-center justify-center bg-gradient-to-br text-xs font-medium",
          className
        )}
      >
        1200 × 630 image
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt=""
      onError={() => setError(true)}
      className={cn("object-cover", className)}
    />
  );
}

/* -------------------------------- previews -------------------------------- */

function GooglePreview({ meta, domain }: { meta: SocialMeta; domain: string }) {
  return (
    <div className="max-w-xl space-y-1">
      <div className="flex items-center gap-2">
        <span className="border-border bg-background flex size-6 items-center justify-center overflow-hidden rounded-full border">
          <Favicon src={meta.favicon} className="size-3.5" />
        </span>
        <div className="leading-tight">
          <div className="text-foreground text-sm">{meta.siteName.trim() || domain}</div>
          <div className="text-muted-foreground text-xs">{domain}</div>
        </div>
      </div>
      <div className="line-clamp-1 text-xl text-[#1a0dab] dark:text-[#8ab4f8]">
        {clip(meta.title, 60) || "Your page title"}
      </div>
      <p className="text-muted-foreground line-clamp-2 text-sm">
        {clip(meta.description, 160) || "Your meta description will appear here in search results."}
      </p>
    </div>
  );
}

function WhatsAppPreview({ meta, domain }: { meta: SocialMeta; domain: string }) {
  return (
    <div className="max-w-[400px] rounded-lg bg-[#d9fdd3] p-1.5 dark:bg-[#005c4b]">
      <div className="bg-background overflow-hidden rounded-md">
        <PreviewImage src={meta.image} className="aspect-[1.91/1] w-full" />
        <div className="space-y-0.5 px-3 py-2">
          <div className="line-clamp-2 text-sm font-medium">{meta.title || "Your page title"}</div>
          <p className="text-muted-foreground line-clamp-1 text-xs">{meta.description}</p>
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <Favicon src={meta.favicon} className="size-3 rounded-sm" />
            {domain}
          </div>
        </div>
      </div>
    </div>
  );
}

function XPreview({ meta, domain }: { meta: SocialMeta; domain: string }) {
  return (
    <div className="border-border max-w-[440px] overflow-hidden rounded-2xl border">
      <PreviewImage src={meta.image} className="aspect-[1.91/1] w-full" />
      <div className="border-border border-t px-3 py-2">
        <div className="text-muted-foreground text-[13px]">{domain}</div>
        <div className="line-clamp-1 text-[15px] font-medium">
          {meta.title || "Your page title"}
        </div>
        <p className="text-muted-foreground line-clamp-1 text-[13px]">{meta.description}</p>
      </div>
    </div>
  );
}

function FacebookPreview({
  meta,
  domain,
  siteName,
}: {
  meta: SocialMeta;
  domain: string;
  siteName: string;
}) {
  return (
    <div className="border-border max-w-[440px] overflow-hidden rounded-lg border">
      <PreviewImage src={meta.image} className="aspect-[1.91/1] w-full" />
      <div className="bg-muted/40 space-y-0.5 px-3 py-2.5">
        <div className="text-muted-foreground text-[11px] tracking-wide uppercase">{domain}</div>
        <div className="line-clamp-2 text-[15px] leading-snug font-semibold">
          {meta.title || "Your page title"}
        </div>
        <p className="text-muted-foreground line-clamp-1 text-[13px]">
          {meta.description || siteName}
        </p>
      </div>
    </div>
  );
}

function SlackPreview({ meta, siteName }: { meta: SocialMeta; siteName: string }) {
  return (
    <div className="max-w-[460px] border-l-4 border-[#e8912d] pl-3">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="bg-muted flex size-4 items-center justify-center overflow-hidden rounded-sm">
          <Favicon src={meta.favicon} className="size-2.5" />
        </span>
        <span className="text-sm font-bold">{siteName}</span>
      </div>
      <div className="line-clamp-1 text-sm font-bold text-[#1264a3] dark:text-[#1d9bd1]">
        {meta.title || "Your page title"}
      </div>
      <p className="text-muted-foreground mb-2 line-clamp-2 text-sm">{meta.description}</p>
      <PreviewImage
        src={meta.image}
        className="border-border aspect-[1.91/1] w-full max-w-[360px] rounded-lg border"
      />
    </div>
  );
}

function DiscordPreview({ meta, siteName }: { meta: SocialMeta; siteName: string }) {
  return (
    <div className="max-w-[440px] rounded-md border-l-4 border-[#5865f2] bg-[#2b2d31] p-3 text-white">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-[#b5bac1]">
        <MoreHorizontalIcon className="size-3" />
        {siteName}
      </div>
      <div className="line-clamp-1 text-[15px] font-semibold text-[#00a8fc]">
        {meta.title || "Your page title"}
      </div>
      <p className="mb-2 line-clamp-3 text-sm text-[#dbdee1]">{meta.description}</p>
      <PreviewImage src={meta.image} className="aspect-[1.91/1] w-full max-w-[380px] rounded" />
    </div>
  );
}
