// ── Settings ───────────────────────────────────────────────────────────────────

/**
 * How the encoder trades quality against pixel dimensions when the target
 * cannot be met at full size.
 *   quality-first    → drop quality all the way to the floor before shrinking
 *   balanced         → drop quality to the mid-point, then shrink
 *   dimensions-first → keep quality high and shrink first
 */
export type CompressionMode = "quality-first" | "balanced" | "dimensions-first";

export interface ConverterSettings {
  /** Global target in KB (1 KB = 1024 bytes) */
  targetKb:      number;
  mode:          CompressionMode;
  /** WebP quality range the search may use, 0–1 */
  minQuality:    number;
  maxQuality:    number;
  /** The longest side is never reduced below this (px) */
  minDimension:  number;
  /** Optional cap on the longest side (px); 0 = keep original size */
  maxDimension:  number;
  /** Images encoded in parallel */
  concurrency:   number;
}

/** The subset of settings the encoder needs for one image */
export interface EncodeOptions {
  targetBytes:  number;
  mode:         CompressionMode;
  minQuality:   number;
  maxQuality:   number;
  minDimension: number;
  maxDimension: number;
}

// ── Results ────────────────────────────────────────────────────────────────────

export interface ProbeResult {
  width:  number;
  height: number;
  /** Small preview (WebP or PNG) — null if the thumbnail could not be made */
  thumbnail: Blob | null;
}

export interface EncodeResult {
  blob:      Blob;
  /** Exact byte size of the produced blob */
  size:      number;
  width:     number;
  height:    number;
  quality:   number;
  /** true only when size <= target */
  targetMet: boolean;
  /** Number of encode passes made */
  attempts:  number;
  /** Dimensions were reduced (by the cap, the canvas limit or the size search) */
  resized:   boolean;
}

export interface EncodeProgress {
  attempt: number;
  quality: number;
  width:   number;
  height:  number;
  /** Size of the last encode pass, bytes */
  lastSize: number;
}

// ── Queue items ────────────────────────────────────────────────────────────────

export type ItemStatus =
  | "probing"     // reading dimensions + building thumbnail
  | "ready"       // decodable, waiting for Start
  | "invalid"     // could not be decoded — will never be converted
  | "queued"
  | "processing"
  | "done"        // see result.targetMet
  | "error"       // conversion failed — retryable
  | "cancelled";  // stopped by the user — retryable

export interface ConverterItem {
  id:     string;
  file:   File;
  name:   string;
  size:   number;
  /** Format label derived from MIME type / extension, e.g. "JPEG" */
  format: string;
  width:  number | null;
  height: number | null;
  thumbnailUrl: string | null;
  status: ItemStatus;
  /** Per-image target override in KB; null = use the global target */
  targetKbOverride: number | null;
  progress: EncodeProgress | null;
  result:   (EncodeResult & { url: string; targetBytes: number }) | null;
  error:    string | null;
  /** Non-fatal notice, e.g. GIF animation loss */
  warning:  string | null;
}

export type BatchState = "idle" | "running" | "paused";
