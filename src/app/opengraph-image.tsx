import { SITE } from "@/constants/site";
import { OG_SIZE, renderOgImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = `${SITE.name} — The Everyday Tool Studio`;

export default function Image() {
  return renderOgImage("The everyday tool studio", SITE.description);
}
