import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { CleanButton, CleanModal } from "../../../atoms/my_clean_code_atoms";
import { formatBytes, formatDimensions } from "../utils/format";
import type { ConverterItem } from "../types";
import styles from "../imageConverter.module.css";

interface PreviewModalProps {
  item:       ConverterItem | null;
  onClose:    () => void;
  onDownload: (id: string) => void;
}

const caption: React.CSSProperties = { margin: "6px 0 0", fontSize: 12, color: "var(--fi-muted)" };

/** Side-by-side original vs WebP. The original's object URL lives only while open. */
export const PreviewModal: React.FC<PreviewModalProps> = ({ item, onClose, onDownload }) => {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const file = item?.file ?? null;

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    return () => { URL.revokeObjectURL(url); setOriginalUrl(null); };
  }, [file]);

  const result = item?.result ?? null;

  return (
    <CleanModal
      isOpen={!!item && !!result}
      onClose={onClose}
      title={item?.name}
      subtitle="Original vs. WebP"
      maxWidth={1000}
      zIndex={99999}
      footer={
        <>
          <span />
          <div style={{ display: "flex", gap: 8 }}>
            <CleanButton variant="outline" size="sm" onClick={onClose}>Close</CleanButton>
            {item && result && (
              <CleanButton variant="primary" size="sm" iconLeft={<Download size={12} />} onClick={() => onDownload(item.id)}>
                Download WebP
              </CleanButton>
            )}
          </div>
        </>
      }
    >
      {item && result && (
        <div className={styles.compare}>
          <figure style={{ margin: 0 }}>
            {originalUrl && <img className={styles.compareImage} src={originalUrl} alt={`Original ${item.name}`} />}
            <figcaption style={caption}>
              Original · {item.format} · {formatDimensions(item.width, item.height)} · {formatBytes(item.size)}
            </figcaption>
          </figure>
          <figure style={{ margin: 0 }}>
            <img className={styles.compareImage} src={result.url} alt={`WebP version of ${item.name}`} />
            <figcaption style={caption}>
              WebP · {formatDimensions(result.width, result.height)} · {formatBytes(result.size)} · quality {Math.round(result.quality * 100)}
            </figcaption>
          </figure>
        </div>
      )}
    </CleanModal>
  );
};
