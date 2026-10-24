import React, { memo, useEffect, useState } from "react";
import { AlertTriangle, Download, ImageIcon, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { CleanButton, CleanInput } from "../../../atoms/my_clean_code_atoms";
import { StatusBadge } from "./StatusBadge";
import { formatBytes, formatDimensions, formatSizeChange } from "../utils/format";
import { validateTargetKb } from "../utils/validation";
import type { ConverterItem } from "../types";
import styles from "../imageConverter.module.css";

interface ImageCardProps {
  item:            ConverterItem;
  globalTargetKb:  number;
  onRemove:        (id: string) => void;
  onRetry:         (id: string) => void;
  onDownload:      (id: string) => void;
  onPreview:       (id: string) => void;
  onOverride:      (id: string, kb: number | null) => void;
}

const meta: React.CSSProperties  = { margin: 0, fontSize: 11, color: "var(--fi-muted)", lineHeight: 1.45 };
const strong: React.CSSProperties = { color: "var(--fi-text)", fontWeight: 600 };

/** Per-image target: empty = use the global target */
const OverrideInput: React.FC<{ value: number | null; globalKb: number; disabled: boolean; onCommit: (kb: number | null) => void }> = ({
  value, globalKb, disabled, onCommit,
}) => {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [open, setOpen] = useState(value !== null);
  const [userOpened, setUserOpened] = useState(false);   // focus only when the user asked for the field
  useEffect(() => setDraft(value === null ? "" : String(value)), [value]);
  const error = draft.trim() === "" ? null : validateTargetKb(draft);

  // Collapsed by default — an input on every card is a lot of height on phones
  if (!open) {
    return (
      <button type="button" className={styles.linkButton} disabled={disabled} onClick={() => { setOpen(true); setUserOpened(true); }}>
        <Pencil size={11} aria-hidden />
        Target: {value === null ? `global (${globalKb} KB)` : `${value} KB`}
      </button>
    );
  }

  return (
    <CleanInput autoFocus={userOpened}
      type="number" label="Target for this image" placeholder={`Global (${globalKb} KB)`} value={draft}
      suffix="KB" disabled={disabled} error={error ?? undefined}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw.trim() === "") onCommit(null);
        else if (!validateTargetKb(raw)) onCommit(Math.round(Number(raw)));
      }}
    />
  );
};

const ImageCardBase: React.FC<ImageCardProps> = ({ item, globalTargetKb, onRemove, onRetry, onDownload, onPreview, onOverride }) => {
  const { result, progress } = item;
  const busy = item.status === "queued" || item.status === "processing";
  const effectiveTargetBytes = Math.round((item.targetKbOverride ?? globalTargetKb) * 1024);
  const staleResult = !!result && result.targetBytes !== effectiveTargetBytes;
  const change = result ? formatSizeChange(item.size, result.size) : null;
  const canRetry = item.status === "error" || item.status === "cancelled" || item.status === "done";

  return (
    <article className={styles.card} aria-label={item.name}>
      {/* ── Header: thumbnail + source info ── */}
      <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
        {result ? (
          <button type="button" className={styles.thumb} onClick={() => onPreview(item.id)} aria-label={`Preview ${item.name}`}>
            {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <ImageIcon size={22} aria-hidden />}
          </button>
        ) : (
          <div className={styles.thumb}>
            {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <ImageIcon size={22} aria-hidden />}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <p className={styles.truncate} title={item.name} style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--fi-text)", flex: 1, minWidth: 0 }}>
              {item.name}
            </p>
            <StatusBadge item={item} />
          </div>
          <p style={meta}>
            {item.format} · {formatDimensions(item.width, item.height)} · {formatBytes(item.size)}
          </p>
        </div>
      </div>

      {/* ── Live progress ── */}
      {busy && (
        <div>
          <div className={styles.track} role="progressbar" aria-label={`Converting ${item.name}`} aria-busy="true">
            {item.status === "processing" && <div className={styles.indeterminate} />}
          </div>
          <p style={{ ...meta, marginTop: 6 }} aria-live="polite">
            {item.status === "queued"
              ? "Waiting in queue…"
              : progress
                ? `Pass ${progress.attempt} · quality ${Math.round(progress.quality * 100)} · ${progress.width}×${progress.height} → ${formatBytes(progress.lastSize)}`
                : "Decoding…"}
          </p>
        </div>
      )}

      {/* ── Result ── */}
      {result && item.status === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 10px", borderRadius: "var(--radius)", background: "var(--sc-surface)" }}>
          <p style={meta}>
            WebP <span style={strong}>{formatBytes(result.size)}</span>
            {" "}· <span style={{ ...strong, color: change?.smaller ? "var(--badge-green-text)" : "var(--badge-amber-text)" }}>{change?.label}</span>
            {" "}· {formatDimensions(result.width, result.height)}{result.resized ? " (resized)" : ""}
            {" "}· quality {Math.round(result.quality * 100)}
          </p>
          <p style={meta}>
            Target {formatBytes(result.targetBytes)} —{" "}
            {result.targetMet
              ? "reached."
              : `not reachable within the quality / dimension limits; this is the smallest result (${formatBytes(result.size - result.targetBytes)} over).`}
          </p>
          {staleResult && (
            <p style={{ ...meta, color: "var(--badge-amber-text)" }}>Target changed — reconvert to apply it.</p>
          )}
        </div>
      )}

      {/* ── Problems ── */}
      {item.error && (item.status === "error" || item.status === "invalid") && (
        <p role="alert" style={{ ...meta, color: "var(--badge-red-text)", display: "flex", gap: 6 }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
          {item.error}
        </p>
      )}
      {item.warning && item.status !== "invalid" && (
        <p style={{ ...meta, color: "var(--badge-amber-text)" }}>{item.warning}</p>
      )}

      {/* ── Per-image target + actions ── */}
      {item.status !== "invalid" && (
        <OverrideInput
          value={item.targetKbOverride} globalKb={globalTargetKb} disabled={busy}
          onCommit={(kb) => onOverride(item.id, kb)}
        />
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "auto" }}>
        {result && item.status === "done" && (
          <CleanButton variant="primary" size="sm" iconLeft={<Download size={12} />} onClick={() => onDownload(item.id)}>
            Download
          </CleanButton>
        )}
        {canRetry && (
          <CleanButton variant="outline" size="sm" iconLeft={<RotateCcw size={12} />} onClick={() => onRetry(item.id)}>
            {item.status === "done" ? "Reconvert" : "Retry"}
          </CleanButton>
        )}
        <CleanButton
          variant="ghost" size="sm" iconLeft={<Trash2 size={12} />} onClick={() => onRemove(item.id)}
          title={`Remove ${item.name}`} style={{ marginLeft: "auto" }}
        >
          Remove
        </CleanButton>
      </div>
    </article>
  );
};

/** Memoised: progress updates re-render only the card that changed */
export const ImageCard = memo(ImageCardBase);
