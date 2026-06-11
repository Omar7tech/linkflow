import { SITE } from "@/constants/site";
import { OG_SIZE, renderOgImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = `${SITE.name} — Free Link & QR Code Toolkit`;

export default function Image() {
  return renderOgImage("Free Link & QR Code Toolkit", SITE.description);
}
