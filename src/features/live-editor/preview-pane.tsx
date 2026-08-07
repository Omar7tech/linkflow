"use client";

import * as React from "react";
import { ExternalLinkIcon, MousePointerClickIcon, RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface HoverInfo {
  selector: string;
  width: number;
  height: number;
}

export const DEVICE_PRESETS: readonly { id: string; label: string; width: number | null }[] = [
  { id: "fill", label: "Fill", width: null },
  { id: "phone", label: "375", width: 375 },
  { id: "phone-l", label: "430", width: 430 },
  { id: "tablet", label: "768", width: 768 },
  { id: "laptop", label: "1024", width: 1024 },
  { id: "desktop", label: "1440", width: 1440 },
];

interface PreviewPaneProps {
  frameRef: React.RefObject<HTMLIFrameElement | null>;
  srcDoc: string;
  /** Changing this remounts the frame, which is what makes "Run" a clean run. */
  runKey: number;
  deviceWidth: number | null;
  onDeviceWidthChange: (width: number | null) => void;
  inspecting: boolean;
  onToggleInspect: () => void;
  hover: HoverInfo | null;
  onReload: () => void;
  onOpenExternal: () => void;
}

function PreviewPaneImpl({
  frameRef,
  srcDoc,
  runKey,
  deviceWidth,
  onDeviceWidthChange,
  inspecting,
  onToggleInspect,
  hover,
  onReload,
  onOpenExternal,
}: PreviewPaneProps) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [stage, setStage] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setStage({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // A device wider than the stage is scaled down rather than clipped, so the
  // layout you are checking is the layout you see.
  const scale = deviceWidth && stage.width ? Math.min(1, stage.width / deviceWidth) : 1;
  const framed = deviceWidth !== null;

  return (
    <div className="bg-card flex min-h-0 flex-1 flex-col">
      <div className="border-border/60 flex items-center gap-1 border-b px-2 py-1.5">
        <div className="chip-rail flex-1 items-center">
          {DEVICE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onDeviceWidthChange(preset.width)}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-[11px] transition-colors",
                deviceWidth === preset.width
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {preset.label}
            </button>
          ))}
          {framed && scale < 1 && (
            <span className="text-muted-foreground ml-1 font-mono text-[10px]">
              {Math.round(scale * 100)}%
            </span>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={inspecting ? "default" : "ghost"}
              size="icon-xs"
              onClick={onToggleInspect}
              aria-pressed={inspecting}
              aria-label="Inspect elements"
            >
              <MousePointerClickIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Inspect — click an element to find it in the markup</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" onClick={onReload} aria-label="Reload preview">
              <RotateCwIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Re-run (Ctrl+Enter)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" onClick={onOpenExternal} aria-label="Open preview in a new tab">
              <ExternalLinkIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open in a new tab</TooltipContent>
        </Tooltip>
      </div>

      <div
        ref={stageRef}
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden",
          framed && "bg-muted/40 flex justify-center"
        )}
      >
        <div
          style={
            framed
              ? {
                  width: deviceWidth! * scale,
                  height: stage.height,
                  overflow: "hidden",
                }
              : { width: "100%", height: "100%" }
          }
          className={cn(framed && "bg-white shadow-xl dark:bg-neutral-900")}
        >
          <iframe
            key={runKey}
            ref={frameRef}
            srcDoc={srcDoc}
            title="Live preview"
            // No allow-same-origin: the preview gets an opaque origin and can't
            // reach this page, its storage or its cookies.
            sandbox="allow-scripts allow-modals allow-popups allow-forms allow-pointer-lock allow-downloads"
            allow="accelerometer; camera; encrypted-media; gyroscope; microphone; midi; xr-spatial-tracking"
            className="block border-0 bg-white"
            style={
              framed
                ? {
                    width: deviceWidth!,
                    height: scale ? stage.height / scale : stage.height,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                  }
                : { width: "100%", height: "100%" }
            }
          />
        </div>

        {inspecting && hover && (
          <div className="bg-foreground text-background pointer-events-none absolute bottom-2 left-2 rounded-md px-2 py-1 font-mono text-[11px] shadow-lg">
            {hover.selector}
            <span className="opacity-60">
              {"  "}
              {hover.width}×{hover.height}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export const PreviewPane = React.memo(PreviewPaneImpl);
