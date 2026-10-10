import * as React from "react";

/**
 * The photo in use, shared by the three effects so that one dropped into any
 * of them is still there after switching to another.
 */
export const PhotoFxImage = React.createContext<{ file: File | null; set(file: File | null): void }>({
  file: null,
  set() {},
});
