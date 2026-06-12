"use client";

import * as React from "react";
import { LayoutGridIcon, MinusIcon, PlusIcon, SparklesIcon, Trash2Icon, WandIcon } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import {
  GRID_PRESETS,
  ITEM_COLORS,
  applyPreset,
  clampArea,
  collides,
  fillEmptyCells,
  isValidTrack,
  sanitizeName,
  toCss,
  toHtml,
  toTailwind,
  uniqueName,
  type GridArea,
  type GridConfig,
} from "@/lib/grid";
import { toast } from "sonner";
import { GridCanvas } from "./grid-canvas";

const MAX_TRACKS = 8;

export function GridTool() {
  const history = useHistory("grid");
  const [config, setConfig] = React.useState<GridConfig>(() => applyPreset(GRID_PRESETS[1]));
  const [presetId, setPresetId] = React.useState(GRID_PRESETS[1].id);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const selected = config.items.find((i) => i.id === selectedId) ?? null;
  const css = toCss(config);
  const html = toHtml(config);
  const tailwind = toTailwind(config);
  const historyLabel = `${config.columns.length}×${config.rows.length} grid · ${config.items.length} areas`;

  const commit = () => history.add(historyLabel, css);

  const createItem = (area: GridArea) => {
    setConfig((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: crypto.randomUUID(),
          name: uniqueName("area", prev.items),
          area,
          color: prev.items.length % ITEM_COLORS.length,
        },
      ],
    }));
  };

  const moveResizeItem = (id: string, area: GridArea) => {
    setConfig((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === id ? { ...i, area } : i)),
    }));
  };

  const removeItem = (id: string) => {
    setConfig((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }));
    setSelectedId(null);
  };

  const renameSelected = (raw: string) => {
    if (!selected) return;
    const base = sanitizeName(raw) || "area";
    const name = uniqueName(base, config.items, selected.id);
    setConfig((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === selected.id ? { ...i, name } : i)),
    }));
  };

  /** Add/remove tracks, clamping or dropping items that fall outside. */
  const setTrackCount = (axis: "columns" | "rows", count: number) => {
    setConfig((prev) => {
      const tracks = [...prev[axis]];
      while (tracks.length < count) tracks.push("1fr");
      tracks.length = count;
      const rows = axis === "rows" ? count : prev.rows.length;
      const cols = axis === "columns" ? count : prev.columns.length;
      const items = prev.items.flatMap((item) => {
        const area = clampArea(item.area, rows, cols);
        if (!area) return [];
        // Drop items whose clamped area now collides with an earlier one.
        return [{ ...item, area }];
      });
      const deduped = items.filter(
        (item, i) => !collides(item.area, items.slice(0, i))
      );
      return { ...prev, [axis]: tracks, items: deduped };
    });
  };

  const setTrack = (axis: "columns" | "rows", index: number, value: string) => {
    const next = value.trim();
    if (!isValidTrack(next)) {
      toast.error(`"${next}" is not a valid track size — try 1fr, auto or 200px`);
      return;
    }
    setConfig((prev) => {
      const tracks = [...prev[axis]];
      tracks[index] = next;
      return { ...prev, [axis]: tracks };
    });
  };

  const fillEmpty = () => {
    setConfig((prev) => {
      const added = fillEmptyCells(prev);
      if (added.length === 0) {
        toast.info("No empty cells to fill");
        return prev;
      }
      return { ...prev, items: [...prev.items, ...added] };
    });
  };

  const clearItems = () => {
    setConfig((prev) => ({ ...prev, items: [] }));
    setSelectedId(null);
  };

  const loadPreset = (id: string) => {
    const preset = GRID_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setConfig(applyPreset(preset));
    setSelectedId(null);
  };

  // Delete/Backspace removes the selected area — unless the user is typing.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (selectedId) removeItem(selectedId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const exportTabs = [
    { id: "css", name: "CSS", code: css },
    { id: "html", name: "HTML", code: html },
    { id: "tailwind", name: "Tailwind", code: tailwind },
  ];

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.grid}
      output={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export</CardTitle>
            <CardDescription>
              Production-ready code, updated live as you edit the canvas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="css" className="w-full">
              <TabsList className="w-full">
                {exportTabs.map((t) => (
                  <TabsTrigger key={t.id} value={t.id} className="flex-1">
                    {t.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {exportTabs.map((t) => (
                <TabsContent key={t.id} value={t.id}>
                  <div className="relative">
                    <pre className="bg-muted/50 border-border max-h-96 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre">
                      {t.code}
                    </pre>
                    <CopyButton
                      text={t.code}
                      label=""
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1.5 right-1.5"
                      successMessage={`${t.name} copied`}
                      onCopied={commit}
                      aria-label={`Copy ${t.name}`}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      }
      footer={<HistoryPanel history={history} />}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGridIcon className="text-primary size-4" />
              Canvas
            </CardTitle>
            <CardDescription>
              Drag across empty cells to draw an area. Drag an area to move it, or pull its
              corners to resize. Click an area to rename or delete it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <GridCanvas
              columns={config.columns}
              rows={config.rows}
              gap={config.gap}
              items={config.items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreate={createItem}
              onMoveResize={moveResizeItem}
            />

            {selected && (
              <div className="border-border bg-muted/30 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2">
                <Label htmlFor="area-name" className="text-xs">
                  Area name
                </Label>
                <Input
                  id="area-name"
                  key={selected.id}
                  defaultValue={selected.name}
                  onBlur={(e) => renameSelected(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className="h-8 w-40 font-mono text-xs"
                />
                <span className="text-muted-foreground font-mono text-xs">
                  rows {selected.area.r1}–{selected.area.r2} · cols {selected.area.c1}–
                  {selected.area.c2}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(selected.id)}
                  className="text-muted-foreground hover:text-destructive ml-auto h-8"
                >
                  <Trash2Icon className="size-3.5" /> Delete
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={fillEmpty}>
                <WandIcon className="size-3.5" /> Fill empty cells
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearItems}
                disabled={config.items.length === 0}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2Icon className="size-3.5" /> Clear areas
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SparklesIcon className="text-primary size-4" />
              Layout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Preset</Label>
                <Select value={presetId} onValueChange={loadPreset}>
                  <SelectTrigger aria-label="Layout preset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRID_PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TrackStepper
                label="Columns"
                count={config.columns.length}
                onChange={(n) => setTrackCount("columns", n)}
              />
              <TrackStepper
                label="Rows"
                count={config.rows.length}
                onChange={(n) => setTrackCount("rows", n)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="grid-gap">Gap</Label>
                <span className="text-muted-foreground font-mono text-xs">{config.gap}px</span>
              </div>
              <Slider
                id="grid-gap"
                min={0}
                max={40}
                step={2}
                value={[config.gap]}
                onValueChange={([gap]) => setConfig((prev) => ({ ...prev, gap }))}
              />
            </div>

            <Separator />

            <TrackSizes
              label="Column sizes"
              tracks={config.columns}
              onChange={(i, v) => setTrack("columns", i, v)}
            />
            <TrackSizes
              label="Row sizes"
              tracks={config.rows}
              onChange={(i, v) => setTrack("rows", i, v)}
            />
            <p className="text-muted-foreground text-xs">
              Any CSS track size works: <code>1fr</code>, <code>auto</code>, <code>240px</code>,{" "}
              <code>minmax(200px, 1fr)</code>…
            </p>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

function TrackStepper({
  label,
  count,
  onChange,
}: {
  label: string;
  count: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onChange(count - 1)}
          disabled={count <= 1}
          aria-label={`Remove ${label.toLowerCase().slice(0, -1)}`}
        >
          <MinusIcon className="size-3.5" />
        </Button>
        <span className="w-8 text-center font-mono text-sm font-bold">{count}</span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onChange(count + 1)}
          disabled={count >= MAX_TRACKS}
          aria-label={`Add ${label.toLowerCase().slice(0, -1)}`}
        >
          <PlusIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function TrackSizes({
  label,
  tracks,
  onChange,
}: {
  label: string;
  tracks: string[];
  onChange: (index: number, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {tracks.map((track, i) => (
          <Input
            key={`${i}-${track}`}
            defaultValue={track}
            onBlur={(e) => e.target.value.trim() !== track && onChange(i, e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="h-8 w-28 font-mono text-xs"
            aria-label={`${label} ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
