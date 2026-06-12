/**
 * Slices an image into a grid and returns an array of Data URLs.
 */
export async function splitImage(
  imageSrc: string,
  cols: number,
  rows: number
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const { width, height } = img;
      const cellWidth = width / cols;
      const cellHeight = height / rows;
      const slices: string[] = [];

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const canvas = document.createElement("canvas");
          canvas.width = cellWidth;
          canvas.height = cellHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }

          ctx.drawImage(
            img,
            x * cellWidth,
            y * cellHeight,
            cellWidth,
            cellHeight,
            0,
            0,
            cellWidth,
            cellHeight
          );
          slices.push(canvas.toDataURL("image/jpeg", 0.95));
        }
      }
      resolve(slices);
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = imageSrc;
  });
}

/**
 * Creates a ZIP file containing the image slices.
 * Instagram grids are uploaded from bottom-right to top-left.
 * We name files accordingly to help the user.
 */
export async function createGridZip(slices: string[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  // Reverse slices for the ZIP naming so Part 1 is the first to upload (the bottom-right one)
  const reversedSlices = [...slices].reverse();

  reversedSlices.forEach((dataUrl, i) => {
    const base64Data = dataUrl.split(",")[1];
    const uploadStep = i + 1;
    zip.file(`step-${String(uploadStep).padStart(2, "0")}-upload-this.jpg`, base64Data, { base64: true });
  });

  return await zip.generateAsync({ type: "blob" });
}
