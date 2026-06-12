"use client";

import * as React from "react";
import { DownloadIcon, ImageIcon, Grid3X3Icon, Trash2Icon, Loader2Icon, UserIcon, GridIcon, BookmarkIcon, TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import { splitImage, createGridZip } from "@/lib/image-splitter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const GRID_PRESETS = [
  { label: "3 x 1", rows: 1, cols: 3 },
  { label: "3 x 2", rows: 2, cols: 3 },
  { label: "3 x 3", rows: 3, cols: 3 },
  { label: "3 x 4", rows: 4, cols: 3 },
];

export function ImageSplitterTool() {
  const history = useHistory("imagesplitter");
  const [image, setImage] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState(3);
  const [slices, setSlices] = React.useState<string[]>([]);
  const [processing, setProcessing] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);

  const cols = 3; // Fixed for Instagram

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image too large (Max 10MB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (prev) => setImage(prev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const updateSlices = React.useCallback(async () => {
    if (!image) return;
    setProcessing(true);
    try {
      const result = await splitImage(image, cols, rows);
      setSlices(result);
    } catch (err) {
      toast.error("Failed to process image");
    } finally {
      setProcessing(false);
    }
  }, [image, rows]);

  React.useEffect(() => {
    updateSlices();
  }, [updateSlices]);

  const handleDownload = async () => {
    if (slices.length === 0) return;
    setDownloading(true);
    try {
      const blob = await createGridZip(slices);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `instagram-grid-3x${rows}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      history.add(`Split into 3x${rows} Instagram grid`, `${slices.length} slices prepared`);
      toast.success("Ready! Upload files from Step 01 to Step 09.");
    } catch (err) {
      toast.error("Failed to create ZIP");
    } finally {
      setDownloading(false);
    }
  };

  const clear = () => {
    setImage(null);
    setSlices([]);
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.imagesplitter}
      output={null}
      footer={<HistoryPanel history={history} />}
    >
      <div className="space-y-8">
        {/* Upload & Controls */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <Grid3X3Icon className="size-4 text-primary" />
              Instagram Grid Setup
            </CardTitle>
            {image && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clear}
                className="h-8 text-[11px] font-bold tracking-tight text-muted-foreground hover:text-destructive"
              >
                <Trash2Icon className="mr-1.5 size-3.5" />
                Change Image
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-8">
            {!image ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 py-16 transition-colors hover:border-primary/20">
                <div className="relative mb-6">
                  <ImageIcon className="text-muted-foreground/20 size-16" />
                  <div className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-black text-background">
                    +
                  </div>
                </div>
                <label className="cursor-pointer">
                  <span className="bg-foreground text-background inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-bold tracking-tight shadow-xl transition-all hover:-translate-y-0.5 active:scale-95">
                    Select High-Res Image
                  </span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
                <p className="text-muted-foreground mt-4 text-xs font-medium tracking-tight">
                  JPG or PNG up to 10MB. Slicing happens locally.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <Field label="Choose Grid Size" hint="Instagram profiles are always 3 columns wide. Pick how many rows you want to fill.">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {GRID_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setRows(p.rows)}
                        className={cn(
                          "flex h-12 items-center justify-center rounded-xl border-2 font-bold transition-all text-sm",
                          rows === p.rows 
                            ? "border-primary bg-primary/5 text-primary" 
                            : "border-border/40 hover:border-border"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="flex items-center gap-4 border-t border-border/40 pt-8">
                  <Button 
                    onClick={handleDownload}
                    disabled={downloading || processing}
                    size="lg"
                    className="h-12 flex-1 rounded-xl px-8 text-base font-bold tracking-tight shadow-lg shadow-primary/10 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    {downloading ? <Loader2Icon className="mr-2 size-5 animate-spin" /> : <DownloadIcon className="mr-2 size-5" />}
                    Download All Slices (.ZIP)
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instagram Profile Mockup Preview */}
        {image && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border/40" />
              <span className="text-muted-foreground/40 font-mono text-[10px] font-bold tracking-widest uppercase">
                Profile Preview
              </span>
              <div className="h-px flex-1 bg-border/40" />
            </div>

            <div className="mx-auto max-w-[400px] overflow-hidden rounded-[2.5rem] border-[8px] border-foreground bg-background shadow-2xl">
              <div className="bg-background px-4 pt-8 pb-4">
                {/* Profile Header Mock */}
                <div className="flex items-center gap-6 mb-6">
                  <div className="size-20 rounded-full bg-muted flex items-center justify-center border border-border/40 overflow-hidden">
                    <UserIcon className="text-muted-foreground/40 size-10" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-24 rounded-full bg-muted" />
                    <div className="flex gap-4">
                      <div className="h-3 w-10 rounded-full bg-muted/60" />
                      <div className="h-3 w-10 rounded-full bg-muted/60" />
                      <div className="h-3 w-10 rounded-full bg-muted/60" />
                    </div>
                  </div>
                </div>
                
                {/* Tab Bar Mock */}
                <div className="flex items-center justify-around border-t border-border/40 pt-3 mb-1">
                  <GridIcon className="size-5 text-foreground" />
                  <BookmarkIcon className="size-5 text-muted-foreground/30" />
                  <TagIcon className="size-5 text-muted-foreground/30" />
                </div>

                {/* The Grid */}
                <div 
                  className="grid gap-[2px] bg-border/40"
                  style={{ 
                    gridTemplateColumns: "repeat(3, 1fr)"
                  }}
                >
                  {slices.map((slice, i) => (
                    <div key={i} className="aspect-square relative group overflow-hidden bg-muted/20">
                      <img 
                        src={slice} 
                        alt="" 
                        className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                      />
                      <div className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-black/60 text-[8px] font-black text-white">
                        {slices.length - i}
                      </div>
                    </div>
                  ))}
                  {/* Fill empty spots to show context if less than 9 */}
                  {Array.from({ length: Math.max(0, 9 - slices.length) }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square bg-muted/10 border border-border/5" />
                  ))}
                </div>
              </div>
              
              {/* Bottom Nav Mock */}
              <div className="h-12 border-t border-border/40 flex items-center justify-around bg-background px-4">
                <div className="size-5 rounded-sm border-2 border-muted" />
                <div className="size-5 rounded-full border-2 border-muted" />
                <div className="size-5 rounded-sm border-2 border-muted" />
              </div>
            </div>
            
            <p className="text-center text-muted-foreground/60 text-[11px] font-medium leading-relaxed">
              The numbers show the <strong>upload order</strong>.<br/>
              Upload #1 first, then #2, and so on to reconstruct the grid correctly.
            </p>
          </div>
        )}
      </div>
    </GeneratorLayout>
  );
}
