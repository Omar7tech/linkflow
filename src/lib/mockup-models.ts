/**
 * Device catalog for the 3D mockup tool. Every device is an artist-made model;
 * nothing about its shape lives in code. To add one, drop the .glb into
 * public/models and describe it here — size, screen and island positions are
 * all measured from the file when it loads.
 *
 * A model must face +Z with +Y up, and keep its screen as a separate mesh.
 */

export interface DeviceModel {
  id: string;
  label: string;
  kind: "phone" | "tablet" | "laptop";
  url: string;
  /** Model units → millimetres (1000 for a file authored in metres). */
  scale: number;
  parts: {
    /** Mesh that displays the uploaded content. */
    screen: string;
    /** Other meshes that sit under the same cover glass as the screen. */
    face: string[];
    /** Camera / sensor hardware lying on the panel — blacked out beneath. */
    island: string[];
  };
  materials: {
    /** Materials exported opaque that are really clear glass: they keep only reflections. */
    clearGlass: string[];
    /** Materials whose exported alpha should be ignored. */
    forceOpaque: string[];
    /** Name prefix of the materials that follow the chosen finish. */
    colored: string;
    /** Which of those belong to the metal frame; the rest follow the back glass. */
    frame: RegExp;
    /** Reference materials — every colored part keeps its tone relative to these. */
    frameRef: string;
    bodyRef: string;
    /** Never recolored (the panel itself). */
    keep: string[];
  };
  /** Finish that leaves the model's own colors untouched. */
  originalFinish: string;
  /** Meshes that take the light tone in clay mode; everything else goes dark. */
  clayBody: RegExp;
}

export const DEVICE_MODELS: readonly DeviceModel[] = [
  {
    id: "iphone",
    label: "iPhone",
    kind: "phone",
    url: "/models/iphone.glb",
    scale: 1000,
    parts: {
      screen: "Front_Screen",
      face: ["Front_Panel"],
      island: ["Front_Sensor", "Front_Cam_Glass"],
    },
    materials: {
      clearGlass: ["BASE_Glass"],
      forceOpaque: ["COLOUR_Cherry_Backpanel"],
      colored: "COLOUR_",
      frame: /Side_Panel|Aniso|Screws|Border/,
      frameRef: "COLOUR_Cherry_Side_Panel",
      bodyRef: "COLOUR_Cherry_Backpanel",
      keep: ["COLOUR_Cherry_Screen"],
    },
    originalFinish: "burgundy",
    clayBody: /^(Side_Panel|Back_Panel|Antenna|Side_Button|Screws)/,
  },
];
