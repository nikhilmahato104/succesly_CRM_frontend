import React from "react";
import { FileArchive, Pause, Play, RotateCcw, Square, Trash2 } from "lucide-react";
import { CleanButton } from "../../../atoms/my_clean_code_atoms";
import { formatBytes, formatSizeChange } from "../utils/format";
import type { ImageConverterApi } from "../hooks/useImageConverter";
import styles from "../imageConverter.module.css";

interface BatchToolbarProps {
  api:         ImageConverterApi;
  canConvert:  boolean;
  zipProgress: number | null;
  onZip:       () => void;
  onClearAll:  () => void;
}

const stat: React.CSSProperties = { fontSize: 12, color: "var(--fi-muted)" };
const num:  React.CSSProperties = { color: "var(--fi-text)", fontWeight: 600 };

export const BatchToolbar: React.FC<BatchToolbarProps> = ({ api, canConvert, zipProgress, onZip, onClearAll }) => {
  const { batch, run, counts } = api;
  const active   = batch !== "idle";
  const pending  = counts.ready + counts.cancelled;
  const finished = counts.done + counts.error;
  const percent  = run && run.total ? Math.round((run.finished / run.total) * 100) : 0;
  const saved    = counts.done ? formatSizeChange(counts.originalBytes, counts.outputBytes) : null;

  // Phones: two buttons per row; ZIP takes its own row when two others are already shown
  const zipClass = active || counts.error > 0 ? styles.fullRow : undefined;

  // Primary action depends on what's left to do
  const primary = (() => {
    if (batch === "running") return <CleanButton variant="outline" size="md" iconLeft={<Pause size={13} />} onClick={api.pause}>Pause</CleanButton>;
    if (batch === "paused")  return <CleanButton variant="primary" size="md" iconLeft={<Play size={13} />} onClick={api.resume}>Resume</CleanButton>;
    if (pending > 0 || counts.probing > 0) {
      return (
        <CleanButton variant="primary" size="md" iconLeft={<Play size={13} />} onClick={api.start} disabled={!canConvert}>
          <span className={styles.desktopOnly}>Start conversion</span>
          <span className={styles.mobileOnly}>Convert</span>
          {pending ? ` (${pending})` : ""}
        </CleanButton>
      );
    }
    if (finished > 0) {
      return <CleanButton variant="outline" size="md" iconLeft={<RotateCcw size={13} />} onClick={api.reconvertAll} disabled={!canConvert}>Reconvert all</CleanButton>;
    }
    return null;
  })();

  return (
    <>
      {/* Actions + progress — pinned while scrolling on phones, so it stays compact */}
      <section className={`${styles.panel} ${styles.toolbar}`} aria-label="Batch controls">
        <div className={styles.toolbarActions}>
          {primary}
          {active && (
            <CleanButton variant="danger" size="md" iconLeft={<Square size={12} />} onClick={api.cancel}>Cancel</CleanButton>
          )}
          {!active && counts.error > 0 && (
            <CleanButton variant="outline" size="md" iconLeft={<RotateCcw size={13} />} onClick={api.retryFailed}>
              Retry failed ({counts.error})
            </CleanButton>
          )}
          <CleanButton
            variant="outline" size="md" iconLeft={<FileArchive size={13} />} className={zipClass}
            onClick={onZip} disabled={counts.done === 0 || zipProgress !== null}
            loading={zipProgress !== null}
            title={counts.exceeded ? `${counts.exceeded} of these are above their target size` : undefined}
          >
            {zipProgress !== null ? `Zipping ${zipProgress}%` : (
              <>
                <span className={styles.desktopOnly}>Download all as ZIP</span>
                <span className={styles.mobileOnly}>Download ZIP</span>
                {counts.done ? ` (${counts.done})` : ""}
              </>
            )}
          </CleanButton>
        </div>

        {/* ── Batch progress ── */}
        {run && run.total > 0 && (
          <div>
            <div
              className={styles.track} role="progressbar" aria-label="Batch progress"
              aria-valuemin={0} aria-valuemax={run.total} aria-valuenow={run.finished}
              aria-valuetext={`${run.finished} of ${run.total} images processed`}
            >
              <div className={styles.fill} style={{ width: `${percent}%` }} />
            </div>
            <p style={{ ...stat, margin: "6px 0 0" }} aria-live="polite">
              {batch === "paused"
                ? `Paused · ${run.finished} of ${run.total} processed${counts.processing ? ` · finishing ${counts.processing} in progress` : ""}`
                : active
                  ? `Converting · ${run.finished} of ${run.total} · ${counts.processing} in progress`
                  : `Finished · ${run.finished} of ${run.total} processed`}
            </p>
          </div>
        )}
      </section>

      {/* ── Totals + housekeeping — scrolls with the page ── */}
      <div className={styles.summaryRow}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", minWidth: 0 }}>
          <span style={stat}><span style={num}>{counts.total}</span> images</span>
          <span style={stat}><span style={{ ...num, color: "var(--badge-green-text)" }}>{counts.met}</span> target met</span>
          <span style={stat}><span style={{ ...num, color: "var(--badge-amber-text)" }}>{counts.exceeded}</span> above target</span>
          <span style={stat}><span style={{ ...num, color: "var(--badge-red-text)" }}>{counts.error + counts.invalid}</span> failed / unsupported</span>
          {saved && (
            <span style={stat}>
              <span style={num}>{formatBytes(counts.originalBytes)}</span> → <span style={num}>{formatBytes(counts.outputBytes)}</span> ({saved.label})
            </span>
          )}
        </div>
        <div className={styles.toolbarSecondary}>
          {counts.invalid > 0 && (
            <CleanButton variant="ghost" size="sm" onClick={api.removeInvalid}>Remove unsupported ({counts.invalid})</CleanButton>
          )}
          <CleanButton variant="ghost" size="sm" iconLeft={<Trash2 size={12} />} onClick={onClearAll}>Clear all</CleanButton>
        </div>
      </div>
    </>
  );
};
