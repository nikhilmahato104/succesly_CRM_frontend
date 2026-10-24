import { MAX_CANVAS_PIXELS, MAX_ENCODE_PASSES, THUMBNAIL_SIZE } from "../config";
import type { CompressionMode, EncodeOptions, EncodeProgress, EncodeResult, ProbeResult } from "../types";

/**
 * Environment-agnostic WebP compression.
 *
 * Runs unchanged inside a Web Worker (OffscreenCanvas) or on the main thread
 * (HTMLCanvasElement) — the caller supplies a CanvasBackend. Every size check
 * uses the byte length of the Blob the browser actually produced.
 */

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface CanvasBackend<S extends CanvasImageSource> {
  create(width: number, height: number): S;
  context(surface: S): Ctx2D;
  encode(surface: S, type: string, quality?: number): Promise<Blob>;
  /** Frees the pixel buffer right away instead of waiting for GC */
  release(surface: S): void;
}

export class CancelledError extends Error {
  constructor() {
    super("Cancelled");
    this.name = "CancelledError";
  }
}

const WEBP = "image/webp";

// ── Decoding ───────────────────────────────────────────────────────────────────

/** Decodes with EXIF orientation applied; throws a readable error for bad files */
export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  try {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (err) {
      // Older engines reject the option itself (TypeError) — retry without it
      if (err instanceof TypeError) return await createImageBitmap(file);
      throw err;
    }
  } catch {
    throw new Error("This image could not be decoded — the file may be corrupted or its format isn't supported by this browser.");
  }
}

// ── Capability check ───────────────────────────────────────────────────────────

/** Browsers that can't encode WebP (e.g. Safari) silently return PNG instead */
export async function supportsWebpEncoding<S extends CanvasImageSource>(backend: CanvasBackend<S>): Promise<boolean> {
  try {
    const surface = backend.create(2, 2);
    backend.context(surface).fillRect(0, 0, 2, 2);
    const blob = await backend.encode(surface, WEBP, 0.8);
    backend.release(surface);
    return blob.type === WEBP;
  } catch {
    return false;
  }
}

// ── Rendering ──────────────────────────────────────────────────────────────────

/**
 * Draws the bitmap at w×h. Large reductions are done in halving steps, which
 * avoids the aliasing a single big downscale produces in some browsers.
 */
function renderScaled<S extends CanvasImageSource>(
  backend: CanvasBackend<S>, bitmap: ImageBitmap, w: number, h: number,
): S {
  let src: CanvasImageSource = bitmap;
  let sw = bitmap.width;
  let sh = bitmap.height;
  let intermediate: S | null = null;

  while (sw / 2 >= w && sh / 2 >= h && sw * sh > 4 * w * h) {
    const nw = Math.max(w, Math.round(sw / 2));
    const nh = Math.max(h, Math.round(sh / 2));
    const step = backend.create(nw, nh);
    const ctx = backend.context(step);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, nw, nh);
    if (intermediate) backend.release(intermediate);
    intermediate = step;
    src = step;
    sw = nw;
    sh = nh;
  }

  const out = backend.create(w, h);
  const ctx = backend.context(out);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  if (intermediate) backend.release(intermediate);
  return out;
}

// ── Probe ──────────────────────────────────────────────────────────────────────

export async function probeImage<S extends CanvasImageSource>(
  backend: CanvasBackend<S>, file: Blob,
): Promise<ProbeResult> {
  const bitmap = await decodeImage(file);
  const { width, height } = bitmap;
  let thumbnail: Blob | null = null;
  try {
    const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(width, height));
    const surface = renderScaled(backend, bitmap, Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    // Falls back to PNG where WebP encoding is unavailable — fine for a preview
    thumbnail = await backend.encode(surface, WEBP, 0.8);
    backend.release(surface);
  } catch {
    thumbnail = null;
  } finally {
    bitmap.close();
  }
  return { width, height, thumbnail };
}

// ── Target-size encoding ───────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Lowest quality a mode will accept before it starts reducing dimensions */
function qualityFloor(mode: CompressionMode, minQ: number, maxQ: number): number {
  switch (mode) {
    case "quality-first":    return minQ;
    case "balanced":         return round2(minQ + (maxQ - minQ) / 2);
    case "dimensions-first": return round2(Math.max(minQ, maxQ - 0.12));
  }
}

interface Attempt { blob: Blob; quality: number; width: number; height: number }

export interface EncodeHooks {
  onProgress?: (p: EncodeProgress) => void;
  isCancelled?: () => boolean;
}

/**
 * Encodes to WebP aiming for `targetBytes`:
 *   1. At the starting size, try max quality, then the mode's quality floor.
 *   2. If even the floor is too big, shrink the image (step estimated from the
 *      size ratio) and retry — until it fits or the minimum dimension is hit.
 *   3. At the minimum dimension, allow quality down to minQuality.
 *   4. When some quality fits, binary-search for the highest one that fits.
 * If nothing fits, the smallest output produced is returned with targetMet=false.
 */
export async function encodeToTarget<S extends CanvasImageSource>(
  backend: CanvasBackend<S>, file: Blob, opts: EncodeOptions, hooks: EncodeHooks = {},
): Promise<EncodeResult> {
  const minQ = Math.min(opts.minQuality, opts.maxQuality);
  const maxQ = Math.max(opts.minQuality, opts.maxQuality);
  const floor = qualityFloor(opts.mode, minQ, maxQ);
  const target = opts.targetBytes;

  const checkCancelled = () => { if (hooks.isCancelled?.()) throw new CancelledError(); };

  const bitmap = await decodeImage(file);
  const W = bitmap.width;
  const H = bitmap.height;
  const longest = Math.max(W, H);

  // Starting scale: user cap and canvas-area limit; never upscale
  let startScale = 1;
  if (opts.maxDimension > 0 && longest > opts.maxDimension) startScale = opts.maxDimension / longest;
  if (W * H * startScale * startScale > MAX_CANVAS_PIXELS) startScale = Math.sqrt(MAX_CANVAS_PIXELS / (W * H));
  const minScale = Math.min(startScale, opts.minDimension > 0 ? Math.min(1, opts.minDimension / longest) : startScale);

  // Mutable encode state lives in one object so closures and control flow agree on it
  const st: { passes: number; smallest: Attempt | null; surface: S | null; w: number; h: number } = {
    passes: 0, smallest: null, surface: null, w: 0, h: 0,
  };

  const dimsFor = (scale: number) => ({
    w: Math.max(1, Math.round(W * scale)),
    h: Math.max(1, Math.round(H * scale)),
  });

  const renderAt = (scale: number): S => {
    const { w, h } = dimsFor(scale);
    if (st.surface && w === st.w && h === st.h) return st.surface;
    if (st.surface) backend.release(st.surface);
    st.surface = renderScaled(backend, bitmap, w, h);
    st.w = w;
    st.h = h;
    return st.surface;
  };

  const attempt = async (surface: S, quality: number): Promise<Attempt> => {
    checkCancelled();
    st.passes++;
    const blob = await backend.encode(surface, WEBP, quality);
    if (blob.type !== WEBP) throw new Error("This browser cannot encode WebP images.");
    const a: Attempt = { blob, quality, width: st.w, height: st.h };
    if (!st.smallest || blob.size < st.smallest.blob.size) st.smallest = a;
    hooks.onProgress?.({ attempt: st.passes, quality, width: st.w, height: st.h, lastSize: blob.size });
    return a;
  };

  const fits = (a: Attempt) => a.blob.size <= target;
  const budgetLeft = () => st.passes < MAX_ENCODE_PASSES;

  /** Highest quality in [lo, hi] that fits, given `loAttempt` (at lo) already fits */
  const bisect = async (surface: S, lo: number, hi: number, loAttempt: Attempt): Promise<Attempt> => {
    let best = loAttempt;
    let a = lo;
    let b = hi;
    while (b - a > 0.025 && budgetLeft()) {
      const mid = round2((a + b) / 2);
      if (mid <= a || mid >= b) break;
      const r = await attempt(surface, mid);
      if (fits(r)) { best = r; a = mid; } else { b = mid; }
    }
    return best;
  };

  const finish = (a: Attempt, targetMet: boolean): EncodeResult => ({
    blob: a.blob, size: a.blob.size, width: a.width, height: a.height, quality: a.quality,
    targetMet, attempts: st.passes, resized: a.width !== W || a.height !== H,
  });

  try {
    let scale = startScale;
    let first = true;

    for (;;) {
      const surface = renderAt(scale);
      let atFloor: Attempt;

      if (first) {
        // At the starting size max quality is the likely winner — try it first
        const top = await attempt(surface, maxQ);
        if (fits(top)) return finish(top, true);
        atFloor = floor < maxQ ? await attempt(surface, floor) : top;
        if (fits(atFloor)) return finish(await bisect(surface, floor, maxQ, atFloor), true);
      } else {
        // After shrinking, the floor is the likely miss — try it first
        atFloor = await attempt(surface, floor);
        if (fits(atFloor)) {
          if (floor < maxQ) {
            const top = await attempt(surface, maxQ);
            if (fits(top)) return finish(top, true);
          }
          return finish(await bisect(surface, floor, maxQ, atFloor), true);
        }
      }
      first = false;

      if (scale <= minScale || !budgetLeft()) break;

      // Output size scales roughly with pixel count → step by sqrt of the overshoot
      const factor = Math.min(0.9, Math.max(0.3, Math.sqrt(target / atFloor.blob.size) * 0.95));
      scale = Math.max(minScale, scale * factor);
      const next = dimsFor(scale);
      if (next.w === st.w && next.h === st.h) break;
    }

    // Smallest allowed size reached — go below the mode's floor if allowed
    if (floor > minQ && budgetLeft() && st.surface) {
      const low = await attempt(st.surface, minQ);
      if (fits(low)) return finish(await bisect(st.surface, minQ, floor, low), true);
    }

    if (!st.smallest) throw new Error("No output was produced.");
    return finish(st.smallest, false);
  } finally {
    if (st.surface) backend.release(st.surface);
    bitmap.close();
  }
}
