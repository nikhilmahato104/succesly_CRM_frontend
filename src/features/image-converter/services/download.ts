import { uniqueNames } from "../utils/files";

/** Saves a blob through a temporary object URL, revoked once the click is handled */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Bundles files into one ZIP. WebP is already compressed, so entries are
 * STOREd — DEFLATE would burn CPU for ~0% gain. JSZip is loaded on demand.
 */
export async function buildZip(
  files: Array<{ name: string; blob: Blob }>,
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const names = uniqueNames(files.map(f => f.name));
  files.forEach((f, i) => zip.file(names[i], f.blob, { binary: true }));
  return zip.generateAsync(
    { type: "blob", compression: "STORE", mimeType: "application/zip", streamFiles: true },
    meta => onProgress?.(meta.percent),
  );
}

export function zipFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `webp-images-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.zip`;
}
