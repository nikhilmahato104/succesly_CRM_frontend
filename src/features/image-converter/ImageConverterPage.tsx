import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { ConfirmDeleteModal } from "../../atoms/my_clean_code_atoms";
import { emitNavDone } from "../../atoms/NavigationProgress";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { DEFAULT_SETTINGS, MAX_FILES } from "./config";
import { useImageConverter, type BatchSummary } from "./hooks/useImageConverter";
import { useZipDownload } from "./hooks/useZipDownload";
import { downloadBlob } from "./services/download";
import { toWebpName } from "./utils/files";
import { UploadDropzone } from "./components/UploadDropzone";
import { SettingsPanel } from "./components/SettingsPanel";
import { BatchToolbar } from "./components/BatchToolbar";
import { ImageCard } from "./components/ImageCard";
import { PreviewModal } from "./components/PreviewModal";
import type { ConverterSettings } from "./types";
import styles from "./imageConverter.module.css";

const notice = (tone: "amber" | "red" | "blue"): React.CSSProperties => ({
  display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: "var(--radius)",
  fontSize: 12, lineHeight: 1.5, background: `var(--badge-${tone}-bg)`, color: `var(--badge-${tone}-text)`,
});

const reportBatch = ({ met, exceeded, failed }: BatchSummary) => {
  const parts = [`${met} met the target`];
  if (exceeded) parts.push(`${exceeded} above target`);
  if (failed) parts.push(`${failed} failed`);
  const message = `Conversion finished: ${parts.join(", ")}.`;
  if (failed || exceeded) showToastnew.warning(message);
  else showToastnew.success(message);
};

/**
 * Bulk Image → WebP converter. Runs entirely in the browser: images are
 * decoded and re-encoded locally and never uploaded.
 */
const ImageConverterPage: React.FC = () => {
  const [settings, setSettings] = useState<ConverterSettings>(DEFAULT_SETTINGS);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const api = useImageConverter(settings, reportBatch);
  const { items, counts, engineStatus } = api;
  const { zipProgress, downloadZip } = useZipDownload();

  // Completes the top navigation progress bar — this page has no data to load
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone()));
  }, []);

  const updateSettings = useCallback((patch: Partial<ConverterSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  const handleFiles = useCallback((files: File[]) => {
    const { added, duplicates, overflow } = api.addFiles(files);
    if (overflow) showToastnew.warning(`Only ${MAX_FILES} images per batch — ${overflow} file${overflow > 1 ? "s were" : " was"} not added.`);
    if (duplicates) showToastnew.info(`${duplicates} duplicate file${duplicates > 1 ? "s" : ""} skipped.`);
    if (!added && !overflow && !duplicates) showToastnew.error("No files were added.");
  }, [api]);

  const { getItem } = api;
  const handleDownload = useCallback((id: string) => {
    const item = getItem(id);
    if (item?.result) downloadBlob(item.result.blob, toWebpName(item.name));
  }, [getItem]);

  const handleZip = useCallback(async () => {
    try {
      const n = await downloadZip(items);
      if (n) showToastnew.success(`ZIP with ${n} image${n > 1 ? "s" : ""} is downloading.`);
    } catch {
      showToastnew.error("Could not create the ZIP — try downloading fewer images or individually.");
    }
  }, [downloadZip, items]);

  const handleClearAll = useCallback(() => {
    if (counts.done > 0 || api.batch !== "idle") setConfirmClear(true);
    else api.clearAll();
  }, [api, counts.done]);

  const previewItem = previewId ? items.find(i => i.id === previewId) ?? null : null;
  const engineReady = engineStatus.state === "ready";

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--fi-text)" }}>Bulk Image to WebP</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--fi-muted)" }}>
          Convert up to {MAX_FILES} images at a time and compress each one toward a target file size. Everything happens in your browser.
        </p>
      </header>

      {engineStatus.state === "loading" && (
        <div style={notice("blue")} role="status">
          <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite", flexShrink: 0, marginTop: 2 }} aria-hidden />
          Checking WebP support in this browser…
        </div>
      )}
      {engineStatus.state === "unsupported" && (
        <div style={notice("red")} role="alert">
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
          {engineStatus.message}
        </div>
      )}

      <UploadDropzone
        remaining={MAX_FILES - counts.total}
        disabled={engineStatus.state === "unsupported"}
        onFiles={handleFiles}
      />

      <SettingsPanel
        settings={settings}
        onChange={updateSettings}
        locked={api.batch !== "idle"}
        engineKind={engineReady ? engineStatus.kind : null}
      />

      {items.length === 0 ? (
        <div className={styles.panel} style={{ textAlign: "center", padding: "28px 16px" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--fi-text)" }}>No images yet</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--fi-muted)" }}>
            Add images above, pick a target size, then press <strong>Start conversion</strong>.
          </p>
          <p style={{ margin: "10px auto 0", fontSize: 11, color: "var(--fi-muted)", maxWidth: 560, display: "flex", gap: 6, justifyContent: "center" }}>
            <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
            Animated GIFs (and animated WebP/PNG) are converted from their first frame only — animation is not preserved.
          </p>
        </div>
      ) : (
        <>
          <BatchToolbar
            api={api}
            canConvert={engineReady}
            zipProgress={zipProgress}
            onZip={handleZip}
            onClearAll={handleClearAll}
          />
          <div className={styles.grid}>
            {items.map(item => (
              <ImageCard
                key={item.id}
                item={item}
                globalTargetKb={settings.targetKb}
                onRemove={api.remove}
                onRetry={api.retry}
                onDownload={handleDownload}
                onPreview={setPreviewId}
                onOverride={api.setOverride}
              />
            ))}
          </div>
        </>
      )}

      <PreviewModal item={previewItem} onClose={() => setPreviewId(null)} onDownload={handleDownload} />

      <ConfirmDeleteModal
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => { api.clearAll(); setConfirmClear(false); }}
        title="Clear all images?"
        description="This removes every image and its converted WebP from this page. Any running conversion is stopped. Download anything you need first."
        zIndex={99999}
      />
    </div>
  );
};

export default ImageConverterPage;
