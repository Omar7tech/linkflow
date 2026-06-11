"use client";

import * as React from "react";
import Image from "next/image";
import { ArchiveIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { SITE } from "@/constants/site";
import { cn } from "@/lib/utils";

type ButtonTheme = "green" | "white";

/** Native asset dimensions are 2× — rendered at half size. */
const SIZES = [
  { id: "small", label: "Small", width: 320, height: 72 },
  { id: "medium", label: "Medium", width: 378, height: 80 },
  { id: "large", label: "Large", width: 414, height: 96 },
] as const;

const FORMATS = ["png", "svg", "eps"] as const;

const USE_CASES = [
  "Landing pages",
  "Contact pages",
  "Mobile apps",
  "Mobile sites",
  "Third-party templates",
];

const assetPath = (theme: ButtonTheme, size: string, format: string) =>
  `/whatsapp-buttons/${theme}-${size}.${format}`;

interface WhatsAppButtonGalleryProps {
  /** The wa.me link currently generated in the tool — powers the embed snippet. */
  link: string | null;
}

export function WhatsAppButtonGallery({ link }: WhatsAppButtonGalleryProps) {
  const [theme, setTheme] = React.useState<ButtonTheme>("green");
  const [snippetSize, setSnippetSize] = React.useState<(typeof SIZES)[number]["id"]>("medium");
  const [zipping, setZipping] = React.useState(false);

  const downloadAll = async () => {
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      await Promise.all(
        (["green", "white"] as const).flatMap((t) =>
          SIZES.flatMap((s) =>
            FORMATS.map(async (f) => {
              const res = await fetch(assetPath(t, s.id, f));
              zip.file(`${t}-${s.id}.${f}`, await res.blob());
            })
          )
        )
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "chat-on-whatsapp-buttons.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("All button designs downloaded");
    } catch {
      toast.error("Couldn't build the ZIP — try the individual downloads");
    } finally {
      setZipping(false);
    }
  };

  const snippet = React.useMemo(() => {
    if (!link) return null;
    const size = SIZES.find((s) => s.id === snippetSize) ?? SIZES[1];
    const src = `${SITE.url}${assetPath(theme, size.id, "png")}`;
    return [
      `<a href="${link}" target="_blank" rel="noopener noreferrer">`,
      `  <img src="${src}" alt="Chat on WhatsApp" width="${size.width / 2}" height="${size.height / 2}" />`,
      `</a>`,
    ].join("\n");
  }, [link, theme, snippetSize]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Official “Chat on WhatsApp” button</CardTitle>
        <CardDescription>
          Meta&apos;s official button designs — download them or embed one with your link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Tabs value={theme} onValueChange={(v) => setTheme(v as ButtonTheme)}>
          <TabsList>
            <TabsTrigger value="green">Green</TabsTrigger>
            <TabsTrigger value="white">White</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-3 lg:grid-cols-3">
          {SIZES.map((size) => (
            <div key={size.id} className="border-border overflow-hidden rounded-lg border">
              <div
                className={cn(
                  "flex items-center justify-center p-5",
                  theme === "white" ? "bg-zinc-800" : "bg-muted/40"
                )}
              >
                <Image
                  src={assetPath(theme, size.id, "png")}
                  alt={`Chat on WhatsApp button — ${theme} ${size.label.toLowerCase()}`}
                  width={size.width / 2}
                  height={size.height / 2}
                  unoptimized
                />
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-muted-foreground text-xs">
                  {size.label} · {size.width}×{size.height}
                </span>
                <div className="flex gap-1">
                  {FORMATS.map((format) => (
                    <Button key={format} asChild variant="ghost" size="xs">
                      <a href={assetPath(theme, size.id, format)} download>
                        {format.toUpperCase()}
                      </a>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" disabled={zipping} onClick={downloadAll}>
          {zipping ? <Loader2Icon className="animate-spin" /> : <ArchiveIcon />}
          Download all designs (ZIP)
        </Button>

        <Separator />

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Embed it with your link</h4>
          {snippet ? (
            <>
              <div className="flex gap-1.5">
                {SIZES.map((size) => (
                  <Badge
                    key={size.id}
                    asChild
                    variant={snippetSize === size.id ? "default" : "outline"}
                    className="cursor-pointer"
                  >
                    <button type="button" onClick={() => setSnippetSize(size.id)}>
                      {size.label}
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="relative">
                <pre className="bg-muted/50 border-border overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                  {snippet}
                </pre>
                <CopyButton
                  text={snippet}
                  label=""
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1.5 right-1.5"
                  successMessage="Button snippet copied"
                  aria-label="Copy button embed snippet"
                />
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">
              Generate a WhatsApp link above and a ready-to-paste HTML snippet appears here, with
              the official button already wired to it.
            </p>
          )}
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <h4 className="text-sm font-medium">Best practices</h4>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs">
              <li>Use the button as is — don&apos;t change, recolor or restyle it.</li>
              <li>Always use the latest version of the button (these are the current designs).</li>
              <li>Make sure the button is visible and easy to read wherever you place it.</li>
            </ul>
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-medium">Works great on</h4>
            <div className="flex flex-wrap gap-1.5">
              {USE_CASES.map((useCase) => (
                <Badge key={useCase} variant="secondary">
                  {useCase}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
