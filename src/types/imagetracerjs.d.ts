declare module "imagetracerjs" {
  export interface TraceColor {
    r: number;
    g: number;
    b: number;
    a: number;
  }

  export interface TraceData {
    layers: unknown[][];
    palette: TraceColor[];
    width: number;
    height: number;
  }

  export interface TraceOptions {
    ltres?: number;
    qtres?: number;
    pathomit?: number;
    rightangleenhance?: boolean;
    colorsampling?: number;
    numberofcolors?: number;
    mincolorratio?: number;
    colorquantcycles?: number;
    layering?: number;
    strokewidth?: number;
    linefilter?: boolean;
    scale?: number;
    roundcoords?: number;
    viewbox?: boolean;
    desc?: boolean;
    blurradius?: number;
    blurdelta?: number;
  }

  const ImageTracer: {
    imagedataToTracedata(imageData: ImageData, options?: TraceOptions): TraceData;
    getsvgstring(traceData: TraceData, options?: TraceOptions): string;
  };

  export default ImageTracer;
}
