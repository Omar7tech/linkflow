/**
 * Device catalog for the 3D mockup tool. Every device is an artist-made model;
 * nothing about its shape lives in code. To add one, drop the .glb into
 * public/models and describe it here — size, screen and island positions are
 * all measured from the file when it loads.
 *
 * A model must face +Z with +Y up, and keep each screen as a separate mesh.
 */

export interface DeviceScreen {
  /** Mesh that displays uploaded content. */
  mesh: string;
  /** Shown in the UI when a device has more than one screen. */
  label: string;
  /** The screen is on the back of the device (faces -Z). */
  back?: boolean;
  /** Camera / sensor hardware lying on this panel — blacked out beneath. */
  island: string[];
}

export interface DeviceModel {
  id: string;
  label: string;
  kind: "phone" | "tablet" | "laptop";
  url: string;
  /** Model units → millimetres (1000 for a file authored in metres). */
  scale: number;
  /** First screen is the main one. */
  screens: DeviceScreen[];
  /** Other meshes that sit under the same cover glass as a screen. */
  face: string[];
  /** An animation in the file exposed as a slider (a hinge, a lid). */
  pose?: { clip: string; label: string };
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
    screens: [{ mesh: "Front_Screen", label: "Screen", island: ["Front_Sensor", "Front_Cam_Glass"] }],
    face: ["Front_Panel"],
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
  {
    id: "iphone-fold",
    label: "iPhone Fold",
    kind: "phone",
    url: "/models/iphone-fold.glb",
    scale: 1000,
    screens: [
      { mesh: "Front_Screen", label: "Inner screen", island: [] },
      { mesh: "Back_Screen", label: "Cover screen", back: true, island: ["Inner_Cam_Black"] },
    ],
    face: ["Front_Panel", "Front_Panel001", "Back_Screen_Display"],
    pose: { clip: "open-close", label: "Fold" },
    materials: {
      clearGlass: ["BASE_Glass"],
      forceOpaque: [],
      colored: "C_",
      frame: /Side|Screws|Antenna/,
      frameRef: "C_StarWhite_Side",
      bodyRef: "C_StarWhite_Backpanel",
      keep: ["C_StarWhite_Screen_Inner", "C_SW_Screen_Outer"],
    },
    originalFinish: "starwhite",
    clayBody: /^(Side_Panel|Back_Panel|Antenna|Side_Buttons|Screws|Axle|Back_Cam_Border$|Back_Cam_Detail)/,
  },
];
