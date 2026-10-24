export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  return `${Number((kb / 1024).toFixed(2))} MB`;   // "50 MB", "1.5 MB", "2.37 MB"
}

/**
 * Size change from original to output, e.g. "−82%" (smaller) or "+12%" (larger).
 * Uses a real minus sign so the two cases read clearly.
 */
export function formatSizeChange(original: number, output: number): { label: string; smaller: boolean } {
  if (original <= 0) return { label: "—", smaller: false };
  const pct = Math.round((1 - output / original) * 100);
  if (pct >= 0) return { label: `−${pct}%`, smaller: true };
  return { label: `+${Math.abs(pct)}%`, smaller: false };
}

export const formatDimensions = (w: number | null, h: number | null): string =>
  w && h ? `${w} × ${h}` : "—";
