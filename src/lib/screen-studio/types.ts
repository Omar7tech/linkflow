/**
 * Screen Studio: a recording plus the edits that turn it into a product
 * video — zooms that follow the action, a styled frame, a camera bubble and
 * captions. Times are in seconds of the source recording.
 */

export interface FocusPoint {
  t: number;
  /** Focus centre, 0–1 across the recording. */
  x: number;
  y: number;
}

export interface Zoom {
  id: string;
  start: number;
  end: number;
  /** 1 = no zoom. */
  scale: number;
  x: number;
  y: number;
  /** Auto zooms follow the detected activity instead of a fixed point. */
  path?: FocusPoint[];
  auto?: boolean;
}

export interface Caption {
  id: string;
  start: number;
  end: number;
  text: string;
}

/** A stretch played faster: dead time an editor would speed through. */
export interface Speed {
  id: string;
  start: number;
  end: number;
  rate: number;
  auto?: boolean;
}

/** A detected click, shown as a ripple. */
export interface Click {
  t: number;
  x: number;
  y: number;
}

export type FrameStyle = "none" | "mac" | "browser" | "glass";
export type Aspect = "16:9" | "4:3" | "1:1" | "4:5" | "9:16";
export type BubbleCorner = "bl" | "br" | "tl" | "tr";

export interface Style {
  background: string;
  /** A user's own wallpaper, as an object URL. */
  backgroundImage?: string;
  padding: number;
  radius: number;
  shadow: number;
  frame: FrameStyle;
  url: string;
  aspect: Aspect;
  /** Zoom motion: 0 = gentle, 1 = snappy. */
  snap: number;
  /** "scene" moves the whole shot like a camera; "window" zooms inside the window. */
  zoomMode: "scene" | "window";
  ripples: boolean;
  intro: boolean;
  /** Even out voice volume and fade the sound in and out on export. */
  cleanAudio: boolean;
  motionBlur: boolean;
  bubble: { show: boolean; corner: BubbleCorner; size: number; shape: "circle" | "rounded" };
  captions: { show: boolean; size: number };
}

export interface Edit {
  trimStart: number;
  trimEnd: number;
  zooms: Zoom[];
  speeds: Speed[];
  clicks: Click[];
  captions: Caption[];
  style: Style;
}

export const ASPECTS: Record<Aspect, number> = { "16:9": 16 / 9, "4:3": 4 / 3, "1:1": 1, "4:5": 4 / 5, "9:16": 9 / 16 };

export const DEFAULT_STYLE: Style = {
  background: "aurora",
  padding: 0.08,
  radius: 14,
  shadow: 0.6,
  frame: "mac",
  url: "tmtools.app",
  aspect: "16:9",
  snap: 0.5,
  zoomMode: "scene",
  ripples: true,
  intro: true,
  cleanAudio: true,
  motionBlur: true,
  bubble: { show: true, corner: "br", size: 0.2, shape: "circle" },
  captions: { show: true, size: 1 },
};

let n = 0;
export const uid = () => `s${Date.now().toString(36)}${(n++).toString(36)}`;
