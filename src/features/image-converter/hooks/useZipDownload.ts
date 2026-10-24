import { useCallback, useRef, useState } from "react";
import { buildZip, downloadBlob, zipFileName } from "../services/download";
import { toWebpName } from "../utils/files";
import type { ConverterItem } from "../types";

/** Builds and saves a ZIP of converted images, exposing progress for the UI */
export function useZipDownload() {
  const [progress, setProgress] = useState<number | null>(null);   // null = not zipping
  const busyRef = useRef(false);

  const downloadZip = useCallback(async (items: ConverterItem[]): Promise<number> => {
    const files = items
      .filter(i => i.status === "done" && i.result)
      .map(i => ({ name: toWebpName(i.name), blob: i.result!.blob }));
    if (!files.length || busyRef.current) return 0;

    busyRef.current = true;
    setProgress(0);
    try {
      const zip = await buildZip(files, p => setProgress(Math.round(p)));
      downloadBlob(zip, zipFileName());
      return files.length;
    } finally {
      busyRef.current = false;
      setProgress(null);
    }
  }, []);

  return { zipProgress: progress, downloadZip };
}
