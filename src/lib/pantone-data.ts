/**
 * A curated subset of the Pantone Matching System (PMS) Solid Coated library.
 *
 * On-screen RGB can only ever approximate a physical Pantone standard, so these
 * hex values are the widely-published sRGB equivalents — close enough to find
 * the right family, never a substitute for a printed swatch book. The list spans
 * the full hue wheel plus the neutral / grey ramps so the nearest-match finder
 * always has good coverage to draw from.
 *
 * `code` is the part that follows "PANTONE" (e.g. "185", "Reflex Blue").
 */

export interface PantoneColor {
  /** Identifier after the word PANTONE — a number or a named ink. */
  code: string;
  /** sRGB hex approximation of the Coated standard. */
  hex: string;
}

export const PANTONE_COLORS: readonly PantoneColor[] = [
  // ---- Named base & process inks -------------------------------------------
  { code: "Yellow", hex: "#FEDD00" },
  { code: "Yellow 012", hex: "#FFD700" },
  { code: "Orange 021", hex: "#FE5000" },
  { code: "Warm Red", hex: "#F9423A" },
  { code: "Red 032", hex: "#EF3340" },
  { code: "Rubine Red", hex: "#CE0058" },
  { code: "Rhodamine Red", hex: "#E10098" },
  { code: "Purple", hex: "#BB29BB" },
  { code: "Violet", hex: "#440099" },
  { code: "Blue 072", hex: "#10069F" },
  { code: "Reflex Blue", hex: "#001489" },
  { code: "Process Blue", hex: "#0085CA" },
  { code: "Green", hex: "#00AB84" },
  { code: "Black", hex: "#2D2926" },
  { code: "Process Yellow", hex: "#FFE600" },
  { code: "Process Magenta", hex: "#EC008C" },
  { code: "Process Cyan", hex: "#009FDA" },
  { code: "Process Black", hex: "#231F20" },

  // ---- Yellows --------------------------------------------------------------
  { code: "100", hex: "#F6EB61" },
  { code: "101", hex: "#F7EA48" },
  { code: "102", hex: "#FCE300" },
  { code: "108", hex: "#FEDD00" },
  { code: "109", hex: "#FFD100" },
  { code: "110", hex: "#DAAA00" },
  { code: "113", hex: "#FCDA60" },
  { code: "116", hex: "#FFCD00" },
  { code: "120", hex: "#FCE38C" },
  { code: "123", hex: "#FFC72C" },
  { code: "124", hex: "#EAAA00" },
  { code: "127", hex: "#EFD659" },
  { code: "130", hex: "#F2A900" },
  { code: "1235", hex: "#FFB81C" },
  { code: "137", hex: "#FFA300" },
  { code: "1375", hex: "#FF9E1B" },
  { code: "143", hex: "#F1B434" },
  { code: "144", hex: "#ED8B00" },

  // ---- Oranges --------------------------------------------------------------
  { code: "151", hex: "#FF8200" },
  { code: "1505", hex: "#FF6900" },
  { code: "158", hex: "#E87722" },
  { code: "165", hex: "#FF671F" },
  { code: "166", hex: "#E35205" },
  { code: "1665", hex: "#DD4814" },
  { code: "172", hex: "#FA4616" },
  { code: "173", hex: "#CB6015" },

  // ---- Reds -----------------------------------------------------------------
  { code: "178", hex: "#FF585D" },
  { code: "179", hex: "#E03C31" },
  { code: "185", hex: "#E4002B" },
  { code: "186", hex: "#C8102E" },
  { code: "187", hex: "#A6192E" },
  { code: "188", hex: "#7C2529" },
  { code: "192", hex: "#E40046" },
  { code: "193", hex: "#BF0D3E" },
  { code: "199", hex: "#D50032" },
  { code: "200", hex: "#BA0C2F" },
  { code: "201", hex: "#9D2235" },
  { code: "202", hex: "#8C1D40" },
  { code: "1788", hex: "#EE2737" },
  { code: "1795", hex: "#D22630" },
  { code: "1797", hex: "#A6192E" },
  { code: "1805", hex: "#AF272F" },
  { code: "1807", hex: "#822433" },
  { code: "209", hex: "#6F263D" },

  // ---- Pinks & magentas -----------------------------------------------------
  { code: "204", hex: "#E56DB1" },
  { code: "211", hex: "#EC7FA9" },
  { code: "213", hex: "#E31C79" },
  { code: "214", hex: "#CE0F69" },
  { code: "219", hex: "#DA1884" },
  { code: "226", hex: "#D0006F" },
  { code: "233", hex: "#C6007E" },
  { code: "241", hex: "#AF1685" },
  { code: "2375", hex: "#C724B1" },
  { code: "2385", hex: "#D539B5" },

  // ---- Purples & violets ----------------------------------------------------
  { code: "248", hex: "#9B26B6" },
  { code: "253", hex: "#8E258D" },
  { code: "259", hex: "#6E1E72" },
  { code: "266", hex: "#753BBD" },
  { code: "267", hex: "#5F259F" },
  { code: "268", hex: "#582C83" },
  { code: "2685", hex: "#330072" },
  { code: "272", hex: "#7C7FCD" },
  { code: "2725", hex: "#4F5DB6" },

  // ---- Blues ----------------------------------------------------------------
  { code: "2728", hex: "#0047BB" },
  { code: "281", hex: "#00205B" },
  { code: "282", hex: "#041E42" },
  { code: "285", hex: "#0072CE" },
  { code: "286", hex: "#0033A0" },
  { code: "287", hex: "#003DA5" },
  { code: "288", hex: "#002D72" },
  { code: "293", hex: "#003594" },
  { code: "2935", hex: "#0057B8" },
  { code: "294", hex: "#002F6C" },
  { code: "2945", hex: "#00549F" },
  { code: "300", hex: "#005EB8" },
  { code: "3005", hex: "#0072CE" },
  { code: "3015", hex: "#00659F" },
  { code: "299", hex: "#00A9E0" },
  { code: "2995", hex: "#00A3E0" },
  { code: "306", hex: "#00B5E2" },
  { code: "540", hex: "#003057" },
  { code: "541", hex: "#003C71" },
  { code: "542", hex: "#6CACE4" },

  // ---- Cyans & teals --------------------------------------------------------
  { code: "3125", hex: "#00B7C3" },
  { code: "311", hex: "#0DB2D3" },
  { code: "312", hex: "#00A0C7" },
  { code: "319", hex: "#2DCCD3" },
  { code: "320", hex: "#009CA6" },
  { code: "321", hex: "#008C95" },
  { code: "326", hex: "#00B2A9" },
  { code: "327", hex: "#008675" },
  { code: "3275", hex: "#00B398" },
  { code: "3285", hex: "#008578" },

  // ---- Greens ---------------------------------------------------------------
  { code: "330", hex: "#00685B" },
  { code: "335", hex: "#00845D" },
  { code: "339", hex: "#00A376" },
  { code: "342", hex: "#006847" },
  { code: "347", hex: "#009A44" },
  { code: "348", hex: "#00843D" },
  { code: "349", hex: "#046A38" },
  { code: "355", hex: "#009639" },
  { code: "356", hex: "#007A33" },
  { code: "357", hex: "#215732" },
  { code: "361", hex: "#43B02A" },
  { code: "368", hex: "#6CC24A" },
  { code: "369", hex: "#64A70B" },
  { code: "375", hex: "#97D700" },
  { code: "376", hex: "#84BD00" },
  { code: "377", hex: "#7A9A01" },
  { code: "382", hex: "#C4D600" },
  { code: "390", hex: "#B5BD00" },

  // ---- Neon (8xx) -----------------------------------------------------------
  { code: "801", hex: "#009ACE" },
  { code: "802", hex: "#44D62C" },
  { code: "803", hex: "#FFE900" },
  { code: "805", hex: "#FF5C39" },
  { code: "806", hex: "#FF0098" },
  { code: "807", hex: "#E20FCA" },

  // ---- Browns & earth -------------------------------------------------------
  { code: "464", hex: "#7A5230" },
  { code: "469", hex: "#693F23" },
  { code: "4625", hex: "#4E2E2D" },
  { code: "7505", hex: "#8C6B4F" },
  { code: "7508", hex: "#D6B195" },
  { code: "7510", hex: "#C77F33" },
  { code: "7512", hex: "#B86125" },
  { code: "728", hex: "#DEB887" },

  // ---- Cool greys -----------------------------------------------------------
  { code: "Cool Gray 1", hex: "#D9D9D6" },
  { code: "Cool Gray 3", hex: "#C8C9C7" },
  { code: "Cool Gray 5", hex: "#B1B3B3" },
  { code: "Cool Gray 7", hex: "#97999B" },
  { code: "Cool Gray 9", hex: "#75787B" },
  { code: "Cool Gray 11", hex: "#53565A" },

  // ---- Warm greys -----------------------------------------------------------
  { code: "Warm Gray 1", hex: "#D7D2CB" },
  { code: "Warm Gray 3", hex: "#BFB8AF" },
  { code: "Warm Gray 5", hex: "#ACA39A" },
  { code: "Warm Gray 7", hex: "#968C83" },
  { code: "Warm Gray 9", hex: "#83786F" },
  { code: "Warm Gray 11", hex: "#6E6259" },

  // ---- Neutral / black ramp -------------------------------------------------
  { code: "427", hex: "#D0D3D4" },
  { code: "429", hex: "#A2AAAD" },
  { code: "430", hex: "#7C878E" },
  { code: "431", hex: "#5B6770" },
  { code: "432", hex: "#333F48" },
  { code: "433", hex: "#1D252D" },
  { code: "Black 6", hex: "#101820" },
  { code: "877", hex: "#8A8D8F" },
  { code: "871", hex: "#84754E" },
];
