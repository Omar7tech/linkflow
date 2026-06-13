"use client";

import * as React from "react";
import {
  CopyPlusIcon,
  EyeIcon,
  LayoutGridIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  WandIcon,
} from "lucide-react";
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
  findFreeArea,
  inBounds,
  isValidTrack,
  sanitizeName,
  toCss,
  toHtml,
  toTailwind,
  uniqueName,
  type GridArea,
  type GridConfig,
} from "@/lib/grid";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GridCanvas } from "./grid-canvas";

const MAX_TRACKS = 8;

export function GridTool() {
  const history = useHistory("grid");
  const [config, setConfig] = React.useState<GridConfig>(() => applyPreset(GRID_PRESETS[1]));
  const [presetId, setPresetId] = React.useState(GRID_PRESETS[1].id);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState(false);

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

  /** Drop a copy of the selected area into the first free slot of the same size. */
  const duplicateSelected = () => {
    if (!selected) return;
    const h = selected.area.r2 - selected.area.r1 + 1;
    const w = selected.area.c2 - selected.area.c1 + 1;
    const area = findFreeArea(config, h, w);
    if (!area) {
      toast.error("No room to duplicate — add a row or column first");
      return;
    }
    const id = crypto.randomUUID();
    setConfig((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { id, name: uniqueName(selected.name, prev.items), area, color: selected.color },
      ],
    }));
    setSelectedId(id);
  };

  /** Arrow-key editing of the selected area: move, or resize the bottom-right edge. */
  const nudgeSelected = (dr: number, dc: number, mode: "move" | "resize") => {
    setConfig((prev) => {
      const idx = prev.items.findIndex((i) => i.id === selectedId);
      if (idx < 0) return prev;
      const a = prev.items[idx].area;
      const area: GridArea =
        mode === "move"
          ? { r1: a.r1 + dr, c1: a.c1 + dc, r2: a.r2 + dr, c2: a.c2 + dc }
          : { r1: a.r1, c1: a.c1, r2: a.r2 + dr, c2: a.c2 + dc };
      if (area.r2 < area.r1 || area.c2 < area.c1) return prev;
      if (!inBounds(area, prev.rows.length, prev.columns.length)) return prev;
      if (collides(area, prev.items, prev.items[idx].id)) return prev;
      const items = [...prev.items];
      items[idx] = { ...items[idx], area };
      return { ...prev, items };
    });
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

  // Keyboard editing of the selected area — disabled while typing or in preview.
  const ARROW_DELTAS: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (preview || !selectedId) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        removeItem(selectedId);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      const delta = ARROW_DELTAS[e.key];
      if (delta) {
        e.preventDefault();
        nudgeSelected(delta[0], delta[1], e.shiftKey ? "resize" : "move");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, preview, config]);

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
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <LayoutGridIcon className="text-primary size-4" />
                  Canvas
                </CardTitle>
                <CardDescription>
                  {preview
                    ? "Live preview of the finished layout."
                    : "Drag across cells to draw an area; drag to move, pull corners to resize. With an area selected, arrow keys move it and Shift + arrows resize."}
                </CardDescription>
              </div>
              <div className="bg-muted/50 flex shrink-0 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setPreview(false)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    !preview ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  )}
                >
                  <PencilIcon className="size-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(true);
                    setSelectedId(null);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    preview ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  )}
                >
                  <EyeIcon className="size-3.5" /> Preview
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview ? (
              <GridPreview config={config} />
            ) : (
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
            )}

            {!preview && selected && (
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
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={duplicateSelected}
                    className="text-muted-foreground h-8"
                    title="Duplicate area (Ctrl/⌘ + D)"
                  >
                    <CopyPlusIcon className="size-3.5" /> Duplicate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(selected.id)}
                    className="text-muted-foreground hover:text-destructive h-8"
                  >
                    <Trash2Icon className="size-3.5" /> Delete
                  </Button>
                </div>
              </div>
            )}

            {!preview && (
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
            )}
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

/** Read-only render of the grid as the finished layout — no editing chrome. */
function GridPreview({ config }: { config: GridConfig }) {
  if (config.items.length === 0) {
    return (
      <div className="border-border/60 text-muted-foreground flex min-h-40 items-center justify-center rounded-xl border border-dashed text-sm">
        Draw some areas in Edit mode to preview the layout.
      </div>
    );
  }
  return (
    <div
      className="rounded-xl"
      style={{
        display: "grid",
        gridTemplateColumns: config.columns.join(" "),
        gridTemplateRows: config.rows.join(" "),
        gap: `${config.gap}px`,
        minHeight: config.rows.length * 56,
      }}
    >
      {config.items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex min-h-12 items-center justify-center rounded-md border px-2 text-center font-mono text-xs font-bold",
            ITEM_COLORS[item.color % ITEM_COLORS.length]
          )}
          style={{
            gridArea: `${item.area.r1} / ${item.area.c1} / ${item.area.r2 + 1} / ${item.area.c2 + 1}`,
          }}
        >
          {item.name}
        </div>
      ))}
    </div>
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
