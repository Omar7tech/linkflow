"use client";

import * as React from "react";
import { ApertureIcon, GripIcon, Layers2Icon } from "lucide-react";
import { ModedTool, type ToolMode } from "@/components/shared/tool-modes";
import { DuotoneTool } from "./duotone-tool";
import { FilterLabTool } from "./filter-tool";
import { HalftoneTool } from "./halftone-tool";
import { PhotoFxImage } from "./photo-fx-image";

const MODES: ToolMode[] = [
  { id: "filters", label: "Filters", icon: ApertureIcon, Tool: FilterLabTool },
  { id: "duotone", label: "Duotone", icon: Layers2Icon, Tool: DuotoneTool },
  { id: "halftone", label: "Halftone", icon: GripIcon, Tool: HalftoneTool },
];

/** Filters, duotone and halftone at one address, working on the same photo. */
export function PhotoFxTool() {
  const [file, set] = React.useState<File | null>(null);
  const shared = React.useMemo(() => ({ file, set }), [file]);
  return (
    <PhotoFxImage value={shared}>
      <ModedTool modes={MODES} label="Effect" />
    </PhotoFxImage>
  );
}
