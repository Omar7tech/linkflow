import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ToolId } from "@/constants/tools";

/**
 * Maps every tool id to its feature component, lazy-loaded so each tool
 * ships as its own chunk. Adding a tool = one entry here + one in TOOLS.
 * TypeScript errors if an id is missing.
 */
export const TOOL_COMPONENTS: Record<ToolId, ComponentType> = {
  universal: dynamic(() => import("./universal/universal-tool").then((m) => m.UniversalTool)),
  whatsapp: dynamic(() => import("./whatsapp/whatsapp-tool").then((m) => m.WhatsAppTool)),
  qr: dynamic(() => import("./qr/qr-tool").then((m) => m.QrTool)),
  share: dynamic(() => import("./share/share-tool").then((m) => m.ShareTool)),
  sms: dynamic(() => import("./sms/sms-tool").then((m) => m.SmsTool)),
  tel: dynamic(() => import("./tel/tel-tool").then((m) => m.TelTool)),
  email: dynamic(() => import("./email/email-tool").then((m) => m.EmailTool)),
  vcard: dynamic(() => import("./vcard/vcard-tool").then((m) => m.VCardTool)),
  utm: dynamic(() => import("./utm/utm-tool").then((m) => m.UtmTool)),
  password: dynamic(() => import("./password/password-tool").then((m) => m.PasswordTool)),
  hash: dynamic(() => import("./hash/hash-tool").then((m) => m.HashTool)),
  lorem: dynamic(() => import("./lorem/lorem-tool").then((m) => m.LoremTool)),
  readtime: dynamic(() => import("./readtime/readtime-tool").then((m) => m.ReadtimeTool)),
  mockup: dynamic(() => import("./mockup/mockup-tool").then((m) => m.MockupTool)),
  favicon: dynamic(() => import("./favicon/favicon-tool").then((m) => m.FaviconTool)),
  jsoncsv: dynamic(() => import("./json-csv/json-csv-tool").then((m) => m.JsonCsvTool)),
  imagesplitter: dynamic(() =>
    import("./image-splitter/image-splitter-tool").then((m) => m.ImageSplitterTool)
  ),
  grid: dynamic(() => import("./grid/grid-tool").then((m) => m.GridTool)),
  glass: dynamic(() => import("./glass/glass-tool").then((m) => m.GlassTool)),
  gradient: dynamic(() => import("./gradient/gradient-tool").then((m) => m.GradientTool)),
  palette: dynamic(() => import("./palette/palette-tool").then((m) => m.PaletteTool)),
  neumorphism: dynamic(() =>
    import("./neumorphism/neumorphism-tool").then((m) => m.NeumorphismTool)
  ),
  bgremover: dynamic(() => import("./bg-remover/bg-remover-tool").then((m) => m.BgRemoverTool)),
  colors: dynamic(() => import("./colors/colors-tool").then((m) => m.ColorsTool)),
  contrast: dynamic(() => import("./contrast/contrast-tool").then((m) => m.ContrastTool)),
  brand: dynamic(() => import("./brand/brand-tool").then((m) => m.BrandTool)),
  fluid: dynamic(() => import("./fluid/fluid-tool").then((m) => m.FluidTool)),
  attention: dynamic(() => import("./attention/attention-tool").then((m) => m.AttentionTool)),
  enhancer: dynamic(() => import("./enhancer/enhancer-tool").then((m) => m.EnhancerTool)),
  easing: dynamic(() => import("./easing/easing-tool").then((m) => m.EasingTool)),
  barcode: dynamic(() => import("./barcode/barcode-tool").then((m) => m.BarcodeTool)),
  glow: dynamic(() => import("./glow/glow-tool").then((m) => m.GlowTool)),
  typography: dynamic(() => import("./typography/typography-tool").then((m) => m.TypographyTool)),
  logo: dynamic(() => import("./logo/logo-tool").then((m) => m.LogoTool)),
  codeshot: dynamic(() => import("./codeshot/codeshot-tool").then((m) => m.CodeshotTool)),
  blob: dynamic(() => import("./blob/blob-tool").then((m) => m.BlobTool)),
  shadow: dynamic(() => import("./shadow/shadow-tool").then((m) => m.ShadowTool)),
  mesh: dynamic(() => import("./mesh/mesh-tool").then((m) => m.MeshTool)),
  pattern: dynamic(() => import("./pattern/pattern-tool").then((m) => m.PatternTool)),
  transform3d: dynamic(() =>
    import("./transform3d/transform3d-tool").then((m) => m.Transform3DTool)
  ),
  clippath: dynamic(() =>
    import("./clippath/clippath-tool").then((m) => m.ClipPathTool)
  ),
  filterlab: dynamic(() =>
    import("./filterlab/filterlab-tool").then((m) => m.FilterLabTool)
  ),
  pantone: dynamic(() => import("./pantone/pantone-tool").then((m) => m.PantoneTool)),
};
