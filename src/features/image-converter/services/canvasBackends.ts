import type { CanvasBackend } from "./compression";

/** OffscreenCanvas — works inside Web Workers and on the main thread */
export const offscreenBackend: CanvasBackend<OffscreenCanvas> = {
  create: (w, h) => new OffscreenCanvas(w, h),
  context: (s) => {
    const ctx = s.getContext("2d");
    if (!ctx) throw new Error("2D canvas is not available.");
    return ctx;
  },
  encode: (s, type, quality) => s.convertToBlob({ type, quality }),
  release: (s) => { s.width = 0; s.height = 0; },
};

/** Classic <canvas> — main-thread fallback for browsers without OffscreenCanvas */
export const domCanvasBackend: CanvasBackend<HTMLCanvasElement> = {
  create: (w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  },
  context: (s) => {
    const ctx = s.getContext("2d");
    if (!ctx) throw new Error("2D canvas is not available.");
    return ctx;
  },
  encode: (s, type, quality) =>
    new Promise<Blob>((resolve, reject) =>
      s.toBlob(b => (b ? resolve(b) : reject(new Error("Canvas encoding failed — the image may be too large."))), type, quality),
    ),
  release: (s) => { s.width = 0; s.height = 0; },
};
