import { TOOL_BY_ID } from "@/constants/tools";
import { OG_SIZE, renderOgImage } from "@/lib/og";

const tool = TOOL_BY_ID.tel;

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = tool.name;

export default function Image() {
  return renderOgImage(tool.name, tool.description);
}
