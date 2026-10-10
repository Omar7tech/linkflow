"use client";

import { EyeIcon, FrameIcon } from "lucide-react";
import { ModedTool, type ToolMode } from "@/components/shared/tool-modes";
import { OgStudioTool } from "./og-studio-tool";
import { SocialPreviewTool } from "./social-preview-tool";

const MODES: ToolMode[] = [
  { id: "design", label: "Design the card", icon: FrameIcon, Tool: OgStudioTool },
  { id: "preview", label: "Preview & meta tags", icon: EyeIcon, Tool: SocialPreviewTool },
];

/** Design a share card, then see how the link unfurls and copy its meta tags. */
export function OgHub() {
  return <ModedTool modes={MODES} label="Step" />;
}
