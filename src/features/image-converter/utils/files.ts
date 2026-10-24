import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES } from "../config";
import { formatBytes } from "./format";

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
};

/** Human format label from MIME type, falling back to the extension */
export function formatLabel(file: File): string {
  const fromMime = file.type.startsWith("image/") ? file.type.slice(6) : "";
  const raw = (fromMime || extensionOf(file.name) || "unknown").replace(/^x-/, "");
  const map: Record<string, string> = { jpg: "JPEG", pjpeg: "JPEG", jfif: "JPEG", "svg+xml": "SVG", "x-icon": "ICO", "vnd.microsoft.icon": "ICO" };
  return (map[raw] ?? raw).toUpperCase();
}

export const isGif = (file: File): boolean =>
  file.type === "image/gif" || extensionOf(file.name) === "gif";

/**
 * Cheap pre-check before decoding. Returns an error message, or null when the
 * file is worth trying. Whether it really decodes is checked afterwards —
 * a ".jpg" can still be corrupt, and HEIC/AVIF/TIFF depend on the browser.
 */
export function precheckFile(file: File): string | null {
  const ext = extensionOf(file.name);
  if (file.type === "image/svg+xml" || ext === "svg") {
    return "SVG is a vector format and is not supported — export it to PNG first.";
  }
  const looksLikeImage = file.type.startsWith("image/") || ACCEPTED_EXTENSIONS.includes(ext);
  if (!looksLikeImage) return "Not an image file.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_FILE_BYTES) return `File is larger than ${formatBytes(MAX_FILE_BYTES)}.`;
  return null;
}

/** Identity used to skip adding the same file twice */
export const fileFingerprint = (file: File): string => `${file.name}|${file.size}|${file.lastModified}`;

/** "photo.final.PNG" → "photo.final.webp" */
export function toWebpName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name) || "image";
  return `${base}.webp`;
}

/** Makes names unique inside one archive: "a.webp", "a (2).webp", … */
export function uniqueNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const dot  = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext  = dot > 0 ? name.slice(dot) : "";
    let candidate = name;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}
