import type { CompressionMode, ConverterSettings } from "./types";

export const IMAGE_CONVERTER_PATH = "/tools/image-converter";

// ── Limits ─────────────────────────────────────────────────────────────────────

export const MAX_FILES          = 100;
export const MAX_FILE_BYTES     = 50 * 1024 * 1024;   // 50 MB per source file
/**
 * Largest canvas (width × height) we ever allocate. Browsers cap canvas area
 * (iOS Safari ≈ 16.7 MP) and a 50 MP RGBA canvas is already ~200 MB of RAM,
 * so bigger sources are scaled down before encoding — and reported as resized.
 */
export const MAX_CANVAS_PIXELS  = 16_000_000;
export const MAX_ENCODE_PASSES  = 24;                 // hard stop per image
export const THUMBNAIL_SIZE     = 160;                // longest side, px

export const MIN_TARGET_KB = 5;
export const MAX_TARGET_KB = 20_480;                  // 20 MB

// ── Presets ────────────────────────────────────────────────────────────────────

export const TARGET_PRESETS_KB = [40, 60, 100, 150, 200, 500] as const;

export const MODE_OPTIONS: Array<{ value: CompressionMode; label: string; hint: string }> = [
  { value: "quality-first",    label: "Quality first",    hint: "Lower quality before reducing dimensions" },
  { value: "balanced",         label: "Balanced",         hint: "Moderate quality loss, then reduce dimensions" },
  { value: "dimensions-first", label: "Dimensions first", hint: "Keep quality high, reduce dimensions first" },
];

const defaultConcurrency = (): number => {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  return Math.max(1, Math.min(4, cores - 1));
};

export const DEFAULT_SETTINGS: ConverterSettings = {
  targetKb:     100,
  mode:         "balanced",
  minQuality:   0.4,
  maxQuality:   0.92,
  minDimension: 320,
  maxDimension: 0,
  concurrency:  defaultConcurrency(),
};

export const MAX_CONCURRENCY = 8;

// ── Formats ────────────────────────────────────────────────────────────────────

/** Extensions accepted by the picker. Decodability is still verified per file. */
export const ACCEPTED_EXTENSIONS = [
  "jpg", "jpeg", "jfif", "pjpeg", "png", "webp", "bmp", "gif", "avif", "ico", "tif", "tiff", "heic", "heif",
];

export const ACCEPT_ATTRIBUTE = ["image/*", ...ACCEPTED_EXTENSIONS.map(e => `.${e}`)].join(",");
