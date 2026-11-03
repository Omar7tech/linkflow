"use client";

import * as React from "react";
import { DownloadIcon, LoaderCircleIcon, PrinterIcon, ScanLineIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { ImageDropzone } from "@/components/shared/image-dropzone";
import { Button } from "@/components/ui/button";
import {
  defaultCorners,
  detectMarkers,
  detectPage,
  extractCells,
  loadPhoto,
  printTemplate,
  templatePng,
  type Photo,
  type Point,
} from "@/lib/font-maker/scan";
import type { Mask } from "@/lib/font-maker/trace";
import { cn } from "@/lib/utils";

interface Sheet {
  id: number;
  photo: Photo;
  corners: Point[];
  page: number;
  found: boolean;
  read?: number;
}

const CORNER_ORDER = [0, 1, 3, 2];

/** The photo with its four corner handles, draggable when detection was off. */
function CornerEditor({ sheet, onChange }: { sheet: Sheet; onChange: (corners: Point[]) => void }) {
  const svg = React.useRef<SVGSVGElement>(null);
  const [drag, setDrag] = React.useState<number | null>(null);
  const { width, height } = sheet.photo;
  const r = Math.max(width, height) * 0.018;

  const toPhoto = (event: React.PointerEvent): Point => {
    const el = svg.current!;
    const pt = el.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const p = pt.matrixTransform(el.getScreenCTM()!.inverse());
    return [Math.max(0, Math.min(width, p.x)), Math.max(0, Math.min(height, p.y))];
  };

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${width} ${height}`}
      className="block w-full touch-none rounded-lg"
      onPointerMove={(event) => {
        if (drag === null) return;
        const next = sheet.corners.slice();
        next[drag] = toPhoto(event);
        onChange(next);
      }}
      onPointerUp={() => setDrag(null)}
      onPointerLeave={() => setDrag(null)}
    >
      <image href={sheet.photo.previewUrl} width={width} height={height} />
      <polygon
        points={CORNER_ORDER.map((i) => sheet.corners[i].join(",")).join(" ")}
        fill="rgb(16 185 129 / 0.12)"
        stroke="rgb(16 185 129)"
        strokeWidth={r * 0.25}
      />
      {sheet.corners.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={r}
          fill="rgb(16 185 129 / 0.35)"
          stroke="#fff"
          strokeWidth={r * 0.2}
          className="cursor-grab"
          onPointerDown={(event) => {
            event.stopPropagation();
            (event.target as Element).setPointerCapture?.(event.pointerId);
            setDrag(i);
          }}
        />
      ))}
    </svg>
  );
}

interface ScanPanelProps {
  fontName: string;
  onImport: (cells: Map<string, Mask>) => void;
}

/**
 * Paper route: print the template, write on it, photograph it. The corners
 * are found automatically; if a photo is unusual they can be dragged into
 * place before the letters are read.
 */
export function ScanPanel({ fontName, onImport }: ScanPanelProps) {
  const [sheets, setSheets] = React.useState<Sheet[]>([]);
  const [busy, setBusy] = React.useState(false);
  const nextId = React.useRef(0);

  const addPhoto = async (file: File) => {
    setBusy(true);
    try {
      const photo = await loadPhoto(file);
      const detected = detectMarkers(photo);
      const corners = detected ?? defaultCorners(photo);
      const page = detected ? detectPage(photo, corners) : 0;
      setSheets((s) => [...s, { id: nextId.current++, photo, corners, page, found: !!detected }]);
      if (!detected) toast.message("Couldn't find all four corner squares. Drag the handles onto them.");
    } catch {
      toast.error("That image couldn't be opened.");
    } finally {
      setBusy(false);
    }
  };

  const update = (id: number, patch: Partial<Sheet>) =>
    setSheets((s) => s.map((sheet) => (sheet.id === id ? { ...sheet, ...patch } : sheet)));

  const read = (sheet: Sheet) => {
    const cells = extractCells(sheet.photo, sheet.corners, sheet.page);
    if (!cells.size) {
      toast.error("No handwriting found. Check the corners sit on the black squares.");
      return;
    }
    onImport(cells);
    update(sheet.id, { read: cells.size });
    toast.success(`Read ${cells.size} characters from page ${sheet.page + 1}`);
  };

  const savePng = async (page: number) => {
    const blob = await templatePng(page, fontName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `font-template-page-${page + 1}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          ["Print", "Two A4 pages. Capitals and lowercase, then numbers, punctuation and second versions."],
          ["Write", "One character per box with a dark pen. Sit letters on the solid line."],
          ["Photograph", "Flat, well lit, all four black squares in the shot. Add each page below."],
        ].map(([title, text], i) => (
          <li key={title} className="border-border/60 rounded-xl border p-4">
            <p className="text-muted-foreground font-mono text-[11px]">0{i + 1}</p>
            <p className="mt-1 text-sm font-medium">{title}</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{text}</p>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => printTemplate(fontName)}>
          <PrinterIcon /> Print template
        </Button>
        <Button variant="outline" onClick={() => void savePng(0)}>
          <DownloadIcon /> Page 1 PNG
        </Button>
        <Button variant="outline" onClick={() => void savePng(1)}>
          <DownloadIcon /> Page 2 PNG
        </Button>
      </div>

      <ImageDropzone onFile={(file) => void addPhoto(file)} hint="A photo or scan of a filled-in page" />
      {busy && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <LoaderCircleIcon className="text-primary size-4 animate-spin" /> Finding the page…
        </p>
      )}

      {sheets.map((sheet) => (
        <div key={sheet.id} className="border-border/60 space-y-3 rounded-xl border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                sheet.found ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              )}
            >
              {sheet.found ? "Corners found" : "Place the corners"}
            </span>
            <div role="radiogroup" aria-label="Page" className="bg-muted/60 flex gap-0.5 rounded-lg p-0.5">
              {[0, 1].map((page) => (
                <button
                  key={page}
                  type="button"
                  role="radio"
                  aria-checked={sheet.page === page}
                  onClick={() => update(sheet.id, { page })}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs",
                    sheet.page === page ? "bg-background font-medium shadow-xs" : "text-muted-foreground"
                  )}
                >
                  Page {page + 1}
                </button>
              ))}
            </div>
            <span className="flex-1" />
            <Button size="sm" onClick={() => read(sheet)}>
              <ScanLineIcon /> {sheet.read ? `Read again (${sheet.read})` : "Read letters"}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Remove photo"
              onClick={() => setSheets((s) => s.filter((x) => x.id !== sheet.id))}
            >
              <XIcon />
            </Button>
          </div>
          <CornerEditor sheet={sheet} onChange={(corners) => update(sheet.id, { corners })} />
        </div>
      ))}
    </div>
  );
}
